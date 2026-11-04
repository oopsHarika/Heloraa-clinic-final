import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const COMMON_PASSWORD = "Heloraa@Demo2026";
const EXPECTED_COUNT = 6220;
const PAGE_SIZE = 1000;
const CONCURRENCY = 3;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function retry(operation, label) {
  for (let attempt = 1; attempt <= 7; attempt++) {
    const result = await operation();

    if (!result.error) return result;

    const message = result.error.message || "Unknown error";
    const retryable =
      /rate.?limit|too many requests|temporar|timeout/i.test(message) ||
      Number(result.error.status) >= 500;

    if (!retryable || attempt === 7) {
      throw new Error(`${label}: ${message}`);
    }

    await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
  }
}

async function getProfiles() {
  const profiles = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .like("email", "%.invalid")
      .in("role", ["doctor", "patient"])
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    profiles.push(...data);

    if (data.length < PAGE_SIZE) break;
  }

  return profiles;
}

async function getAuthUsers() {
  const users = [];

  for (let page = 1; ; page++) {
    const { data, error } =
      await supabase.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });

    if (error) throw error;

    users.push(...data.users);

    if (data.users.length < PAGE_SIZE) break;
  }

  return users;
}

async function getMappings() {
  const mappings = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("heloraa_auth_id_map")
      .select("old_profile_id,new_auth_id,email,role")
      .order("old_profile_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    mappings.push(...data);

    if (data.length < PAGE_SIZE) break;
  }

  return mappings;
}

async function main() {
  console.log("Reading imported profiles...");

  const profiles = await getProfiles();

  if (profiles.length !== EXPECTED_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_COUNT} profiles, found ${profiles.length}.`
    );
  }

  const emails = new Set();

  for (const profile of profiles) {
    const email = profile.email?.trim().toLowerCase();

    if (!email || !email.endsWith(".invalid")) {
      throw new Error(`Invalid imported email: ${profile.email}`);
    }

    if (!["doctor", "patient"].includes(profile.role)) {
      throw new Error(`Unexpected role: ${profile.role}`);
    }

    if (emails.has(email)) {
      throw new Error(`Duplicate email: ${email}`);
    }

    emails.add(email);
  }

  const doctors = profiles.filter(p => p.role === "doctor").length;
  const patients = profiles.filter(p => p.role === "patient").length;

  if (doctors !== 5056 || patients !== 1164) {
    throw new Error(
      `Unexpected counts: ${doctors} doctors, ${patients} patients.`
    );
  }

  console.log("Verified 6,220 imported profiles.");

  const [authUsers, mappings] = await Promise.all([
    getAuthUsers(),
    getMappings(),
  ]);

  const authByEmail = new Map(
    authUsers
      .filter(u => u.email)
      .map(u => [u.email.toLowerCase(), u])
  );

  const mappingById = new Map(
    mappings.map(m => [m.old_profile_id, m])
  );

  // Preflight all accounts before creating any.
  for (const profile of profiles) {
    const email = profile.email.toLowerCase();
    const existing = authByEmail.get(email);
    const mapping = mappingById.get(profile.id);

    if (
      existing &&
      existing.user_metadata?.heloraa_import !== true
    ) {
      throw new Error(
        `Existing unmarked Auth account found: ${email}`
      );
    }

    if (
      mapping &&
      (
        mapping.email.toLowerCase() !== email ||
        mapping.role !== profile.role ||
        (existing && mapping.new_auth_id !== existing.id)
      )
    ) {
      throw new Error(`Mapping conflict: ${email}`);
    }
  }

  let nextIndex = 0;
  let completed = 0;
  let created = 0;
  let reused = 0;
  let fatalError = null;

  async function worker() {
    while (!fatalError) {
      const index = nextIndex++;

      if (index >= profiles.length) return;

      const profile = profiles[index];
      const email = profile.email.toLowerCase();

      try {
        let user = authByEmail.get(email);

        if (!user) {
          const { data, error } = await retry(
            () =>
              supabase.auth.admin.createUser({
                email,
                password: COMMON_PASSWORD,
                email_confirm: true,
                user_metadata: {
                  heloraa_import: true,
                  full_name: profile.full_name || "",
                  role: profile.role,
                },
              }),
            `Creating ${email}`
          );

          if (error) throw error;

          user = data.user;

          if (!user?.id) {
            throw new Error(`No Auth ID returned for ${email}`);
          }

          authByEmail.set(email, user);
          created++;
        } else {
          reused++;
        }

        const oldMapping = mappingById.get(profile.id);

        if (oldMapping && oldMapping.new_auth_id !== user.id) {
          throw new Error(`Auth ID mismatch: ${email}`);
        }

        if (!oldMapping) {
          const { error } = await retry(
            () =>
              supabase
                .from("heloraa_auth_id_map")
                .upsert(
                  {
                    old_profile_id: profile.id,
                    new_auth_id: user.id,
                    email,
                    role: profile.role,
                  },
                  { onConflict: "old_profile_id" }
                ),
            `Saving mapping for ${email}`
          );

          if (error) throw error;

          mappingById.set(profile.id, {
            old_profile_id: profile.id,
            new_auth_id: user.id,
            email,
            role: profile.role,
          });
        }

        completed++;

        if (completed % 50 === 0) {
          console.log(
            `Progress: ${completed}/${EXPECTED_COUNT}`
          );
        }
      } catch (error) {
        fatalError = error;
        console.error(`Stopped at ${email}:`, error.message);
      }
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker())
  );

  if (fatalError) {
    console.error(
      "Stopped safely. Do not delete created Auth accounts."
    );
    console.error(
      "Fix the issue before running the script again."
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nAccount creation completed!");
  console.log("Processed:", completed);
  console.log("New Auth accounts:", created);
  console.log("Existing imported accounts reused:", reused);
  console.log("Password:", COMMON_PASSWORD);
  console.log(
    "Profile IDs and medical-data relationships were not changed."
  );
}

main().catch(error => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
