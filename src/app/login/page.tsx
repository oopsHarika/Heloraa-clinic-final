"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // 1. Sign in
      const { data: authData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      const user = authData.user;

      if (!user) {
        setError("Login failed. User not found.");
        return;
      }

      // 2. Retrieve the user's profile and role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile lookup failed:", profileError.message);
        setError("Unable to load your account profile. Please try again.");
        return;
      }

      if (!profile) {
        setError(
          "Your account profile could not be found. Please contact support."
        );
        return;
      }

      // 3. Redirect according to role
      if (profile.role === "admin") {
        router.replace("/admin");
        router.refresh();
        return;
      }

      if (profile.role === "doctor") {
        router.replace("/doctor");
        router.refresh();
        return;
      }

      if (profile.role === "patient") {
        // Check whether this patient already has a patient record.
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (patientError) {
          console.error("Patient lookup failed:", patientError.message);
          setError(
            "Unable to load your patient details. Please try signing in again."
          );
          return;
        }

        // Existing patient: go straight to the portal.
        if (patient) {
          router.replace("/patient");
        } else {
          // New patient without a health profile: complete onboarding.
          router.replace("/patient/onboarding");
        }

        router.refresh();
        return;
      }

      setError("Your account has an invalid or unsupported role.");
    } catch (err) {
      console.error(
        "Login failed:",
        err instanceof Error ? err.message : err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while logging in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
          
          {/* LEFT SIDE */}
          <div className="login-brand-panel relative hidden overflow-hidden bg-gradient-to-br from-[#123F38] via-[#176B5B] to-[#0D5148] p-10 !text-white lg:flex lg:flex-col lg:justify-between">
            {/* Decorative background elements */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-teal-200/10 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white !text-[#15594D] text-lg font-bold shadow-lg">
                  H
                </div>

                <div>
                  <p className="!text-white text-lg font-semibold">
                    Heloraa Clinic
                  </p>
                  <p className="!text-emerald-100 text-sm">
                    Connected healthcare
                  </p>
                </div>
              </div>

              <div className="mt-16">
                <p className="!text-emerald-200 text-sm font-semibold tracking-wide">
                  WELCOME TO HELORAA
                </p>

                <h1 className="mt-4 !text-white text-4xl font-bold leading-tight tracking-tight">
                  Healthcare,
                  <br />
                  connected intelligently.
                </h1>

                <p className="mt-6 max-w-md !text-emerald-50/90 text-base leading-8">
                  Manage appointments, medical records, medications and
                  AI-assisted healthcare insights from one secure platform.
                </p>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3">
              <div className="login-feature-card rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="!text-white text-lg font-bold">AI</p>
                <p className="mt-2 !text-emerald-100 text-xs">
                  Assisted care
                </p>
              </div>

              <div className="login-feature-card rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="!text-white text-lg font-bold">RAG</p>
                <p className="mt-2 !text-emerald-100 text-xs">
                  Medical context
                </p>
              </div>

              <div className="login-feature-card rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="!text-white text-lg font-bold">Secure</p>
                <p className="mt-2 !text-emerald-100 text-xs">
                  Patient data
                </p>
              </div>
            </div>
          </div>


          {/* RIGHT SIDE */}
          <div className="flex items-center p-8 sm:p-12">
            <div className="w-full">
              <div className="mb-8">
                <p className="text-sm font-medium text-slate-500">
                  Secure access
                </p>

                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Sign in to your Heloraa Clinic account.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {/* EMAIL */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-[#0A0D14] focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                {/* PASSWORD */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-[#0A0D14] focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="-mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* ERROR */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}

                {/* LOGIN BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#0A0D14] px-4 py-3.5 font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              {/* SIGNUP LINK */}
              <div className="mt-7 text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}