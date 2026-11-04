
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import ProfileMenu from "@/components/ProfileMenu";

export default async function PatientPage() {
  const supabase = await createClient();

  // 1. Authenticate the user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 2. Fetch profile and patient record simultaneously
  const [
    { data: profile },
    {
      data: patient,
      error: patientError,
    },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),

    supabase
      .from("patients")
      .select("id, profile_id, date_of_birth, gender, blood_group")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  if (patientError) {
    console.error("Patient query failed:", patientError);
  }

  // 3. Fetch dashboard data simultaneously
  const [
    { data: appointments },
    { data: records },
    { data: medications },
    { data: notifications },
  ] = await Promise.all([
    patient
      ? supabase
          .from("appointments")
          .select(`
            *,
            doctors (
              specialization,
              profile_id
            )
          `)
          .eq("patient_id", patient.id)
          .order("appointment_date", { ascending: true })
      : Promise.resolve({ data: [] }),

    patient
      ? supabase
          .from("medical_records")
          .select("*")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    patient
      ? supabase
          .from("medications")
          .select("*")
          .eq("patient_id", patient.id)
          .eq("active", true)
      : Promise.resolve({ data: [] }),

    supabase
      .from("notifications")
      .select(`
        id,
        title,
        message,
        type,
        read,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const unreadNotifications =
    notifications?.filter((notification) => !notification.read).length || 0;

  return (
    <main className="page-shell min-h-screen bg-[#F8FAFC] text-[#0A0D14]">
      <div className="flex min-h-screen">

        {/* ================= SIDEBAR ================= */}

        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">

          <div className="border-b border-slate-100 px-6 py-6">
            <Link href="/patient">
              <p className="text-lg font-semibold tracking-tight">
                Heloraa Clinic
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Patient Portal
              </p>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6">

            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Overview
            </p>

            <Link
              href="/patient"
              className="mt-3 flex items-center gap-3 rounded-xl bg-[#0A0D14] px-3 py-3 text-sm font-medium text-white"
            >
              <span>⌂</span>
              Dashboard
            </Link>

            <p className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Healthcare
            </p>

            <div className="mt-3 space-y-1">

              <Link
                href="/patient/appointments"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span>◷</span>
                Appointments
              </Link>

              <Link
                href="/patient/appointments"
                className="ml-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100"
              >
                <span>+</span>
                Book an Appointment
              </Link>

              <Link
                href="/patient/medical-records"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span>▣</span>
                Medical Records
              </Link>

              <Link
                href="/patient/medications"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span>✚</span>
                Medications
              </Link>

              <Link
                href="/patient/assistant"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span>✦</span>
                AI Assistant
              </Link>

              <Link
                href="/patient/notifications"
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span className="flex items-center gap-3">
                  <span>♢</span>
                  Notifications
                </span>

                {unreadNotifications > 0 && (
                  <span className="rounded-full bg-[#0A0D14] px-2 py-0.5 text-[10px] font-medium text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Link>

            </div>

          </nav>

          <div className="border-t border-slate-100 p-4">

            <div className="mb-3 rounded-xl bg-slate-50 p-3">

              <p className="truncate text-sm font-medium">
                {profile?.full_name || "Patient"}
              </p>

              <p className="truncate text-xs text-slate-500">
                {profile?.email || user.email}
              </p>

            </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/patient/onboarding?edit=1"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Edit Profile
                </Link>

                <div className="flex-1">
                  <LogoutButton />
                </div>
              </div>

          </div>

        </aside>

        {/* ================= MAIN ================= */}

        <div className="min-w-0 flex-1">

          {/* Top bar */}

          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">

            <div className="flex h-16 items-center justify-between px-5 sm:px-8">

              <div>
                <p className="text-sm text-slate-500">
                  Patient Portal
                </p>
              </div>

              <div className="flex items-center gap-3">

                <Link
                  href="/patient/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:bg-slate-50"
                >
                  ♢

                  {unreadNotifications > 0 && (
                    <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#0A0D14]" />
                  )}
                </Link>

                <ProfileMenu
                  name={profile?.full_name}
                  canEdit={true}
                />

              </div>

            </div>

          </header>

          {/* Content */}

          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">

            {/* Welcome */}

            <section>

              <p className="text-sm text-slate-500">
                Good to see you
              </p>

              <div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

                <div>

                  <h1 className="text-3xl font-semibold tracking-tight">
                    Welcome, {profile?.full_name || "Patient"}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Manage your appointments, records, medications
                    and healthcare with Heloraa Clinic.
                  </p>

                </div>

                <Link
                  href="/patient/appointments"
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#0A0D14] px-5 py-3 text-sm font-medium text-white transition hover:bg-black"
                >
                  <span>+</span>
                  Book Appointment
                </Link>

              </div>

            </section>

            {/* ================= HEALTH SNAPSHOT ================= */}

            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Blood Group
                </p>

                <p className="mt-3 text-2xl font-semibold">
                  {patient?.blood_group || "—"}
                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Gender
                </p>

                <p className="mt-3 text-2xl font-semibold">
                  {patient?.gender || "—"}
                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Appointments
                </p>

                <p className="mt-3 text-2xl font-semibold">
                  {appointments?.length || 0}
                </p>

                <Link
                  href="/patient/appointments"
                  className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-[#0A0D14]"
                >
                  View appointments →
                </Link>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Active Medications
                </p>

                <p className="mt-3 text-2xl font-semibold">
                  {medications?.length || 0}
                </p>

                <Link
                  href="/patient/medications"
                  className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-[#0A0D14]"
                >
                  View medications →
                </Link>

              </div>

            </section>

            {/* ================= QUICK ACTIONS ================= */}

            <section className="mt-8">

              <h2 className="text-lg font-semibold">
                Quick Actions
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                <Link
                  href="/patient/appointments"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0D14] text-white">
                    +
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Book Appointment
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Schedule a consultation with a doctor.
                  </p>
                </Link>

                <Link
                  href="/patient/medical-records"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    ▣
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Medical Records
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    View your medical history.
                  </p>
                </Link>

                <Link
                  href="/patient/medications"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    ✚
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Medications
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Check active medications.
                  </p>
                </Link>

                <Link
                  href="/patient/assistant"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0D14] text-white">
                    ✦
                  </div>

                  <h3 className="mt-4 font-semibold">
                    AI Assistant
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Ask questions about your health records.
                  </p>
                </Link>

              </div>

            </section>

            {/* ================= APPOINTMENTS + NOTIFICATIONS ================= */}

            <div className="mt-8 grid gap-6 xl:grid-cols-2">

              {/* Appointments */}

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>
                    <h2 className="text-lg font-semibold">
                      Upcoming Appointments
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Your scheduled consultations.
                    </p>
                  </div>

                  <Link
                    href="/patient/appointments"
                    className="text-sm font-medium text-slate-600 hover:text-[#0A0D14]"
                  >
                    View all →
                  </Link>

                </div>

                <div className="mt-5 space-y-3">

                  {appointments?.slice(0, 3).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="font-medium">
                            {appointment.appointment_type}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {appointment.reason || "Consultation"}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">
                          {appointment.status}
                        </span>

                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        {appointment.appointment_date} ·{" "}
                        {appointment.appointment_time}
                      </p>

                    </div>
                  ))}

                  {!appointments?.length && (
                    <div className="rounded-xl bg-slate-50 p-6 text-center">

                      <p className="text-sm font-medium">
                        No appointments yet
                      </p>

                      <Link
                        href="/patient/appointments"
                        className="mt-2 inline-block text-sm text-slate-500 underline"
                      >
                        Book your first appointment
                      </Link>

                    </div>
                  )}

                </div>

              </section>

              {/* Notifications */}

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>
                    <h2 className="text-lg font-semibold">
                      Notifications
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Messages and reminders from Heloraa Clinic.
                    </p>
                  </div>

                  <Link
                    href="/patient/notifications"
                    className="text-sm font-medium text-slate-600 hover:text-[#0A0D14]"
                  >
                    View all →
                  </Link>

                </div>

                <div className="mt-5 space-y-3">

                  {notifications?.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-xl border p-4 ${
                        !notification.read
                          ? "border-slate-300 bg-slate-50"
                          : "border-slate-100"
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A0D14] text-white">
                          🔔
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-3">

                            <h3 className="text-sm font-semibold">
                              {notification.title || "Heloraa Clinic"}
                            </h3>

                            {!notification.read && (
                              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium">
                                Unread
                              </span>
                            )}

                          </div>

                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {notification.message}
                          </p>

                          <p className="mt-2 text-[11px] text-slate-400">
                            {new Date(
                              notification.created_at
                            ).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>

                        </div>

                      </div>

                    </div>
                  ))}

                  {!notifications?.length && (
                    <div className="rounded-xl bg-slate-50 p-6 text-center">

                      <p className="text-sm font-medium">
                        No notifications
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        You&apos;re all caught up.
                      </p>

                    </div>
                  )}

                </div>

              </section>

            </div>

            {/* ================= MEDICAL RECORDS ================= */}

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-lg font-semibold">
                    Recent Medical Records
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your latest healthcare information.
                  </p>
                </div>

                <Link
                  href="/patient/medical-records"
                  className="text-sm font-medium text-slate-600 hover:text-[#0A0D14]"
                >
                  View all →
                </Link>

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                {records?.slice(0, 4).map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {record.record_type}
                    </p>

                    <h3 className="mt-2 font-semibold">
                      {record.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {record.description}
                    </p>

                    <div className="mt-4 rounded-lg bg-white p-3">

                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Assessment
                      </p>

                      <p className="mt-1 text-sm">
                        {record.diagnosis || "No assessment recorded"}
                      </p>

                    </div>

                  </div>
                ))}

                {!records?.length && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center md:col-span-2">
                    <p className="text-sm font-medium">
                      No medical records available
                    </p>
                  </div>
                )}

              </div>

            </section>

            {/* ================= MEDICATIONS ================= */}

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-lg font-semibold">
                    Current Medications
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your currently active medications.
                  </p>
                </div>

                <Link
                  href="/patient/medications"
                  className="text-sm font-medium text-slate-600 hover:text-[#0A0D14]"
                >
                  View all →
                </Link>

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                {medications?.slice(0, 4).map((medication) => (
                  <div
                    key={medication.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >

                    <h3 className="font-semibold">
                      {medication.medication_name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {medication.dosage} · {medication.frequency}
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      {medication.instructions}
                    </p>

                  </div>
                ))}

                {!medications?.length && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center md:col-span-2">
                    <p className="text-sm font-medium">
                      No active medications
                    </p>
                  </div>
                )}

              </div>

            </section>

            {/* ================= AI ================= */}

            <section className="mt-8 overflow-hidden rounded-2xl bg-[#0A0D14] p-6 text-white shadow-sm sm:p-8">

              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

                <div className="max-w-2xl">

                  <div className="flex items-center gap-2">

                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                      ✦
                    </span>

                    <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
                      Heloraa AI Assistant
                    </span>

                  </div>

                  <h2 className="mt-4 text-2xl font-semibold">
                    Your health information, connected.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Ask questions about your medical records and
                    get context-aware assistance based on the
                    information available in your Heloraa Clinic profile.
                  </p>

                </div>

                <Link
                  href="/patient/assistant"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#0A0D14] transition hover:bg-slate-100"
                >
                  Open AI Assistant →
                </Link>

              </div>

            </section>

            <div className="mt-8 flex items-center gap-3 lg:hidden">
              <Link
                href="/patient/onboarding?edit=1"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Edit Profile
              </Link>

              <div className="flex-1">
                <LogoutButton />
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}