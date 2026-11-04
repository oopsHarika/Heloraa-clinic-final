import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createCommunicationNotification } from "@/lib/notifications/communication";
import RescheduleAppointment from "@/components/RescheduleAppointment";

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string | null;
  status: string | null;
  reason: string | null;
  doctors:
    | {
        specialization: string | null;
        profiles:
          | {
              full_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusClasses(status: string | null) {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "cancelled":
    case "canceled":
      return "bg-red-50 text-red-700 border-red-200";

    case "scheduled":
    case "confirmed":
      return "bg-blue-50 text-blue-700 border-blue-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getDoctorName(appointment: Appointment) {
  return appointment.doctors?.[0]?.profiles?.[0]?.full_name || "Doctor";
}

function getSpecialization(appointment: Appointment) {
  return appointment.doctors?.[0]?.specialization || "General Medicine";
}

async function cancelAppointment(formData: FormData) {
  "use server";

  const appointmentId = formData.get("appointment_id");

  if (!appointmentId || typeof appointmentId !== "string") {
    return;
  }

  const supabase = await createClient();

  // Get currently logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  // Find the patient's profile
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patient) {
    return;
  }

  // Fetch appointment and doctor details before cancellation
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select(`
      id,
      appointment_date,
      appointment_time,
      doctors (
        profiles (
          id,
          full_name
        )
      )
    `)
    .eq("id", appointmentId)
    .eq("patient_id", patient.id)
    .in("status", ["scheduled", "confirmed"])
    .maybeSingle();

  if (fetchError || !appointment) {
    console.error("Appointment lookup failed:", fetchError);
    return;
  }

  // Cancel the appointment
  const { data: cancelledAppointment, error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
    })
    .eq("id", appointmentId)
    .eq("patient_id", patient.id)
    .in("status", ["scheduled", "confirmed"])
    .select("id")
    .maybeSingle();

  if (error || !cancelledAppointment) {
    console.error("Cancel appointment error:", error);
    return;
  }

  // Identify the doctor
  const doctor = Array.isArray(appointment.doctors)
    ? appointment.doctors[0]
    : appointment.doctors;

  const doctorProfile = Array.isArray(doctor?.profiles)
    ? doctor.profiles[0]
    : doctor?.profiles;

  // Notify the doctor through the Communication Agent
  if (doctorProfile?.id) {
    try {
      await createCommunicationNotification({
        recipientUserId: doctorProfile.id,
        type: "appointment_cancellation",
        appointmentId: appointment.id,
        source: "appointment_cancellation",
        context: `The patient has cancelled their appointment scheduled for ${appointment.appointment_date} at ${appointment.appointment_time}.`,
      });
    } catch (notificationError) {
      console.error(
        "CANCELLATION NOTIFICATION ERROR:",
        notificationError
      );
    }
  }

  // Refresh the appointments page
  revalidatePath("/patient/appointments");
}

/* -------------------------------------------------------
   PAGE
------------------------------------------------------- */

export default async function PatientAppointmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="page-shell min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#0A0D14]">
            Please log in
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            You need to be logged in to view your appointments.
          </p>

          <Link
            href="/login"
            className="inline-flex mt-5 rounded-lg bg-[#0A0D14] px-5 py-2.5 text-sm font-medium text-white hover:bg-black transition"
          >
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  // Find patient's profile
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (patientError || !patient) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/patient"
            className="text-sm text-slate-500 hover:text-[#0A0D14]"
          >
            ← Back to Dashboard
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-[#0A0D14]">
              Patient profile not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              We couldn&apos;t find a patient profile associated with your
              account.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Get appointments
  const { data: appointmentData, error: appointmentError } =
    await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        appointment_type,
        status,
        reason,
        doctors (
          specialization,
          profiles (
            full_name
          )
        )
      `)
      .eq("patient_id", patient.id)
      .order("appointment_date", {
        ascending: true,
      })
      .order("appointment_time", {
        ascending: true,
      });

  if (appointmentError) {
    console.error("Appointment fetch error:", appointmentError);
  }

  const appointments = (appointmentData || []) as unknown as Appointment[];

  const upcoming = appointments.filter((appointment) => {
    const status = appointment.status?.toLowerCase();

    return (
      status !== "completed" &&
      status !== "cancelled" &&
      status !== "canceled"
    );
  });

  const completed = appointments.filter(
    (appointment) => appointment.status?.toLowerCase() === "completed"
  );

  const cancelled = appointments.filter((appointment) => {
    const status = appointment.status?.toLowerCase();

    return status === "cancelled" || status === "canceled";
  });

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/patient"
              className="text-sm text-slate-500 hover:text-[#0A0D14] transition"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#0A0D14]">
              My Appointments
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              View and manage your scheduled consultations.
            </p>
          </div>

          <Link
            href="/patient/appointments/book"
            className="inline-flex items-center justify-center rounded-lg bg-[#0A0D14] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            + Book an Appointment
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Upcoming
            </p>

            <p className="mt-2 text-2xl font-semibold text-[#0A0D14]">
              {upcoming.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Completed
            </p>

            <p className="mt-2 text-2xl font-semibold text-[#0A0D14]">
              {completed.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Cancelled
            </p>

            <p className="mt-2 text-2xl font-semibold text-[#0A0D14]">
              {cancelled.length}
            </p>
          </div>

        </div>

        {/* Upcoming */}
        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#0A0D14]">
              Upcoming Appointments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Your scheduled consultations.
            </p>
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                📅
              </div>

              <h3 className="mt-4 text-sm font-semibold text-[#0A0D14]">
                No upcoming appointments
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Book a consultation with one of our doctors.
              </p>

              <Link
                href="/patient/appointments/book"
                className="mt-5 inline-flex rounded-lg bg-[#0A0D14] px-4 py-2 text-sm font-medium text-white hover:bg-black transition"
              >
                Book Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>
          )}

        </section>

        {/* Completed */}
        <section className="mt-10">

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#0A0D14]">
              Completed
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Your previous consultations.
            </p>
          </div>

          {completed.length === 0 ? (
            <EmptyState message="No completed appointments yet." />
          ) : (
            <div className="space-y-4">
              {completed.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>
          )}

        </section>

        {/* Cancelled */}
        <section className="mt-10 pb-10">

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#0A0D14]">
              Cancelled
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cancelled appointment history.
            </p>
          </div>

          {cancelled.length === 0 ? (
            <EmptyState message="No cancelled appointments." />
          ) : (
            <div className="space-y-4">
              {cancelled.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>
          )}

        </section>

      </div>
    </main>
  );
}

/* -------------------------------------------------------
   APPOINTMENT CARD
------------------------------------------------------- */

function AppointmentCard({
  appointment,
}: {
  appointment: Appointment;
}) {
  const doctorName = getDoctorName(appointment);
  const specialization = getSpecialization(appointment);

  const status = appointment.status?.toLowerCase();

  const canCancel =
    status === "scheduled" || status === "confirmed";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

        {/* Doctor */}
        <div className="flex items-start gap-4">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
            👨‍⚕️
          </div>

          <div>
            <h3 className="font-semibold text-[#0A0D14]">
              {doctorName}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {specialization}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {appointment.appointment_type || "Consultation"}
            </p>
          </div>

        </div>

        {/* Appointment Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Date
            </p>

            <p className="mt-1 text-sm font-medium text-[#0A0D14]">
              {formatDate(appointment.appointment_date)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Time
            </p>

            <p className="mt-1 text-sm font-medium text-[#0A0D14]">
              {formatTime(appointment.appointment_time)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Status
            </p>

            <span
              className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                appointment.status
              )}`}
            >
              {appointment.status || "Scheduled"}
            </span>
          </div>

        </div>

      </div>

      {/* Reason */}
      {appointment.reason && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Reason for Visit
          </p>

          <p className="mt-1 text-sm text-slate-600">
            {appointment.reason}
          </p>
        </div>
      )}

      {/* Appointment Actions */}
{canCancel && (
  <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4">

    {/* Reschedule */}
    <RescheduleAppointment
      appointmentId={appointment.id}
      currentDate={appointment.appointment_date}
      currentTime={appointment.appointment_time}
    />

    {/* Cancel */}
    <div className="flex justify-end">
      <form action={cancelAppointment}>
        <input
          type="hidden"
          name="appointment_id"
          value={appointment.id}
        />

        <button
          type="submit"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
        >
          Cancel Appointment
        </button>
      </form>
    </div>

  </div>
)}

    </div>
  );
}

/* -------------------------------------------------------
   EMPTY STATE
------------------------------------------------------- */

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <p className="text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}