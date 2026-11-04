
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmailConfirmedPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/patient/onboarding");
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl text-teal-700">
          ✓
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900">
          You're all set!
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          Your email has been verified successfully.
          Welcome to Heloraa Clinic!
        </p>

        <p className="mt-5 text-sm text-slate-500">
          Taking you to your patient onboarding page...
        </p>
      </section>
    </main>
  );
}
