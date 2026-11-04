import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "@/components/LogoutButton";
import ProfileMenu from "@/components/ProfileMenu";

export default async function DoctorPage() {
  // =====================================================
  // AUTHENTICATED SUPABASE CLIENT
  // =====================================================

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // =====================================================
  // SERVICE ROLE CLIENT
  // Used only on the server to reliably read doctor data
  // without browser RLS relationship issues.
  // =====================================================

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing.");
  const adminSupabase = createAdminClient();

  
  // =====================================================
  // DOCTOR + PROFILE (PARALLEL)
  // =====================================================

  const [doctorResult, profileResult] = await Promise.all([
    adminSupabase
      .from("doctors")
      .select("*")
      .eq("profile_id", user.id)
      .single(),

    adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
  ]);

  const doctor = doctorResult.data;
  const profile = profileResult.data;

  // =====================================================
  // ASSIGNED PATIENTS + APPOINTMENTS (PARALLEL)
  // =====================================================

  const [patientsResult, appointmentsResult] = await Promise.all([
    doctor
      ? adminSupabase
          .from("patients")
          .select(`
            *,
            profiles (
              full_name,
              email,
              phone
            )
          `)
          .eq("assigned_doctor_id", doctor.id)
      : Promise.resolve({ data: [] }),

    doctor
      ? adminSupabase
          .from("appointments")
          .select("*")
          .eq("doctor_id", doctor.id)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const patients = patientsResult.data || [];
  const rawAppointments = appointmentsResult.data || [];

  let appointments = rawAppointments;

  // =====================================================
  // ATTACH PATIENT NAMES TO APPOINTMENTS
  // =====================================================

  if (appointments.length > 0) {
    const patientIds = [
      ...new Set(
        appointments
          .map((appointment) => appointment.patient_id)
          .filter(Boolean)
      ),
    ];

    const { data: patientRows } = await adminSupabase
      .from("patients")
      .select("id, profile_id")
      .in("id", patientIds);

    const profileIds = [
      ...new Set(
        (patientRows || [])
          .map((patient) => patient.profile_id)
          .filter(Boolean)
      ),
    ];

    const { data: profileRows } =
      profileIds.length > 0
        ? await adminSupabase
            .from("profiles")
            .select("id, full_name")
            .in("id", profileIds)
        : { data: [] };

    const profileMap = new Map(
      (profileRows || []).map((profile) => [
        profile.id,
        profile.full_name,
      ])
    );

    const patientMap = new Map(
      (patientRows || []).map((patient) => [
        patient.id,
        {
          profile_id: patient.profile_id,
          full_name: patient.profile_id
            ? profileMap.get(patient.profile_id) ||
              "Unknown Patient"
            : "Unknown Patient",
        },
      ])
    );

    appointments = appointments.map((appointment) => ({
      ...appointment,
      patientInfo:
        patientMap.get(appointment.patient_id) || {
          profile_id: null,
          full_name: "Unknown Patient",
        },
    }));
  }


  // =====================================================
  // DATE / STATS
  // =====================================================

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const todayAppointments =
    appointments.filter(
      (appointment) =>
        appointment.appointment_date === today
    );

  const pendingAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status?.toLowerCase() ===
        "pending"
    );

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="page-shell min-h-screen bg-[#F8FAFC] text-[#0A0D14]">

      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
        ====================================================== */}

        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">

          <div className="sticky top-0 flex h-screen flex-col">

            <div className="border-b border-slate-200 px-6 py-6">

              <h1 className="text-xl font-semibold">
                Heloraa Clinic
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Doctor Portal
              </p>

            </div>

            <nav className="flex-1 px-4 py-6">

              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Overview
              </p>

              <a
                href="#dashboard"
                className="mt-3 flex items-center gap-3 rounded-xl bg-[#0A0D14] px-4 py-3 text-sm font-medium text-white"
              >
                <span>⌂</span>
                Dashboard
              </a>

              <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Clinical
              </p>

              <a
                href="#patients"
                className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>♙</span>
                Patients
              </a>

              <a
                href="#appointments"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>◷</span>
                Appointments
              </a>

              <a
                href="#records"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>▣</span>
                Medical Records
              </a>

              <a
                href="#risk"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>!</span>
                Risk Alerts
              </a>

              <a
                href="#ai-assistant"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>✦</span>
                AI Assistant
              </a>

            </nav>

            <div className="border-t border-slate-200 p-4">

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-sm font-semibold">
                  {profile?.full_name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {doctor?.specialization || "Doctor"}
                </p>

              </div>

              <div className="mt-4">
                <LogoutButton />
              </div>

            </div>

          </div>

        </aside>

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <div className="min-w-0 flex-1">

          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">

            <div className="flex h-16 items-center justify-between px-6 lg:px-8">

              <div>

                <p className="text-sm text-slate-500">
                  Doctor Portal
                </p>

              </div>

              <ProfileMenu
                name={profile?.full_name}
                canEdit={false}
              />

            </div>

          </header>

          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

            {/* =================================================
                DASHBOARD HEADER
            ================================================== */}

            <section id="dashboard">

              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

                <div>

                  <p className="text-sm text-slate-500">
                    Good to see you
                  </p>

                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    Welcome, {profile?.full_name}
                  </h1>

                  <p className="mt-2 text-sm text-slate-500">
                    Manage your patients, appointments and
                    clinical information from one place.
                  </p>

                </div>

                <Link
                  href="#appointments"
                  className="inline-flex items-center justify-center rounded-xl bg-[#0A0D14] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                >
                  View Appointments →
                </Link>

              </div>

              {/* Stats */}

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <p className="text-sm text-slate-500">
                    My Patients
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {patients?.length || 0}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Currently assigned
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <p className="text-sm text-slate-500">
                    Appointments
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {appointments.length}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Total scheduled
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <p className="text-sm text-slate-500">
                    Today
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {todayAppointments.length}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Today&apos;s appointments
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <p className="text-sm text-slate-500">
                    Pending
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {pendingAppointments.length}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Awaiting action
                  </p>

                </div>

              </div>

            </section>

            {/* =================================================
                QUICK ACTIONS
            ================================================== */}

            <section className="mt-10">

              <div>

                <h2 className="text-xl font-semibold">
                  Quick Actions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Access the most important clinical operations.
                </p>

              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <a
                  href="#patients"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    ♙
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Patients
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    View assigned patients and their clinical details.
                  </p>

                </a>

                <a
                  href="#appointments"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    ◷
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Appointments
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Review scheduled consultations.
                  </p>

                </a>

                <a
                  href="#risk"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    !
                  </div>

                  <h3 className="mt-4 font-semibold">
                    Risk Alerts
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Run AI-powered patient risk analysis.
                  </p>

                </a>

                <a
                  href="#ai-assistant"
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    ✦
                  </div>

                  <h3 className="mt-4 font-semibold">
                    AI Assistant
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Generate AI clinical insights for patients.
                  </p>

                </a>

              </div>

            </section>

            {/* =================================================
                PATIENTS
            ================================================== */}

            <section
              id="patients"
              className="mt-12 scroll-mt-24"
            >

              <div className="flex items-end justify-between">

                <div>

                  <h2 className="text-xl font-semibold">
                    My Patients
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Patients currently assigned to you.
                  </p>

                </div>

                <span className="text-sm text-slate-400">
                  {patients?.length || 0} patients
                </span>

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

                {patients?.map((patient) => (

                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >

                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold">
                          {patient.profiles?.full_name
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>

                          <h3 className="font-semibold">
                            {patient.profiles?.full_name}
                          </h3>

                          <p className="text-xs text-slate-500">
                            {patient.gender || "Patient"}
                          </p>

                        </div>

                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        Active
                      </span>

                    </div>

                    <div className="mt-5 space-y-3 text-sm">

                      <div className="flex justify-between">

                        <span className="text-slate-500">
                          Blood Group
                        </span>

                        <span className="font-medium">
                          {patient.blood_group || "—"}
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-slate-500">
                          Date of Birth
                        </span>

                        <span className="font-medium">
                          {patient.date_of_birth || "—"}
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-slate-500">
                          Email
                        </span>

                        <span className="max-w-40 truncate font-medium">
                          {patient.profiles?.email || "—"}
                        </span>

                      </div>

                    </div>

                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="mt-5 flex items-center justify-center rounded-xl bg-[#0A0D14] px-4 py-3 text-sm font-medium text-white hover:opacity-90"
                    >
                      Open Patient Profile →
                    </Link>

                  </div>

                ))}

              </div>

              {!patients?.length && (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">

                  <p className="font-medium">
                    No patients assigned
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Assigned patients will appear here.
                  </p>

                </div>
              )}

            </section>

            {/* =================================================
                APPOINTMENTS
            ================================================== */}

            <section
              id="appointments"
              className="mt-12 scroll-mt-24"
            >

              <div className="flex items-end justify-between">

                <div>

                  <h2 className="text-xl font-semibold">
                    Appointments
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review your upcoming consultations.
                  </p>

                </div>

                <span className="text-sm text-slate-400">
                  {appointments.length} total
                </span>

              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

                {appointments.map((appointment, index) => (

                  <div
                    key={appointment.id}
                    className={`p-5 ${
                      index !== appointments.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }`}
                  >

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div className="flex items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold">
                          {appointment.patientInfo?.full_name
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>

                          <h3 className="font-semibold">
                            {appointment.patientInfo?.full_name ||
                              "Unknown Patient"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {appointment.appointment_type ||
                              "Consultation"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {appointment.reason ||
                              "No reason provided"}
                          </p>

                        </div>

                      </div>

                      <div className="flex flex-wrap items-center gap-3">

                        <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">

                          <p className="font-medium">
                            {appointment.appointment_date}
                          </p>

                          <p className="text-xs text-slate-500">
                            {appointment.appointment_time}
                          </p>

                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium">
                          {appointment.status}
                        </span>

                      </div>

                    </div>

                  </div>

                ))}

                {!appointments.length && (
                  <div className="p-10 text-center">

                    <p className="font-medium">
                      No appointments found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Your scheduled consultations will appear here.
                    </p>

                  </div>
                )}

              </div>

            </section>

            {/* =================================================
                MEDICAL RECORDS
            ================================================== */}

            <section
              id="records"
              className="mt-12 scroll-mt-24"
            >

              <div>

                <h2 className="text-xl font-semibold">
                  Medical Records
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Open a patient profile to review their medical history,
                  medications and clinical records.
                </p>

              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">

                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    ▣
                  </div>

                  <div>

                    <h3 className="font-semibold">
                      Patient Medical History
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Select any patient above to view their medical
                      records, diagnosis, treatment, vitals and active
                      medications.
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* =================================================
                RISK ALERTS
            ================================================== */}

            <section
              id="risk"
              className="mt-12 scroll-mt-24"
            >

              <div>

                <h2 className="text-xl font-semibold">
                  Risk Alerts
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Use AI risk analysis from each patient&apos;s profile.
                </p>

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                {patients?.map((patient) => (

                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >

                    <div className="flex items-center justify-between">

                      <div>

                        <h3 className="font-semibold">
                          {patient.profiles?.full_name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          AI-powered risk assessment
                        </p>

                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                        AI
                      </span>

                    </div>

                    <Link
                      href={`/doctor/patients/${patient.id}/risk`}
                      className="mt-5 inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                    >
                      Run Risk Analysis →
                    </Link>

                  </div>

                ))}

              </div>

            </section>

            {/* =================================================
                AI ASSISTANT
            ================================================== */}

            <section
              id="ai-assistant"
              className="mt-12 scroll-mt-24"
            >

              <div>

                <h2 className="text-xl font-semibold">
                  AI Assistant
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Use the AI clinical tools available for your patients.
                </p>

              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-[#0A0D14] p-6 text-white">

                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                  <div>

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                        ✦
                      </div>

                      <h3 className="font-semibold">
                        AI Clinical Intelligence
                      </h3>

                    </div>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Generate clinical summaries and run AI-powered
                      risk analysis using the patient&apos;s available
                      medical information.
                    </p>

                  </div>

                  <div className="text-sm text-slate-400">
                    {patients?.length || 0} patients available
                  </div>

                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">

                  {patients?.slice(0, 4).map((patient) => (

                    <div
                      key={patient.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                    >

                      <div>

                        <p className="text-sm font-medium">
                          {patient.profiles?.full_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          AI clinical tools
                        </p>

                      </div>

                      <Link
                        href={`/doctor/patients/${patient.id}/summary`}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#0A0D14] hover:bg-slate-100"
                      >
                        Summary
                      </Link>

                    </div>

                  ))}

                </div>

              </div>

            </section>

          </div>

        </div>

      </div>

    </main>
  );
}
