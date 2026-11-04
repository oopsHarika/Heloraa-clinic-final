import { createClient } from "@/lib/supabase/server";
import { createCommunicationNotification } from "@/lib/notifications/communication";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Authenticate patient
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to reschedule." },
        { status: 401 }
      );
    }

    // 2. Read request
    const body = await request.json();

    const {
      appointmentId,
      appointmentDate,
      appointmentTime,
    } = body;

    if (
      typeof appointmentId !== "string" ||
      typeof appointmentDate !== "string" ||
      typeof appointmentTime !== "string" ||
      !appointmentId.trim() ||
      !appointmentDate.trim() ||
      !appointmentTime.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Appointment ID, new date and new time are required.",
        },
        { status: 400 }
      );
    }

    // 3. Validate date and time formats
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
      !/^\d{2}:\d{2}$/.test(appointmentTime)
    ) {
      return NextResponse.json(
        { error: "Invalid appointment date or time." },
        { status: 400 }
      );
    }

    const [year, month, day] = appointmentDate
      .split("-")
      .map(Number);

    const requestedDate = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (
      requestedDate.getUTCFullYear() !== year ||
      requestedDate.getUTCMonth() !== month - 1 ||
      requestedDate.getUTCDate() !== day
    ) {
      return NextResponse.json(
        { error: "Invalid appointment date." },
        { status: 400 }
      );
    }

    const [hours, minutes] = appointmentTime
      .split(":")
      .map(Number);

    if (hours > 23 || minutes > 59) {
      return NextResponse.json(
        { error: "Invalid appointment time." },
        { status: 400 }
      );
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (appointmentDate < today) {
      return NextResponse.json(
        { error: "Please select a future date." },
        { status: 400 }
      );
    }

    // 4. Find the logged-in patient's profile
    const { data: patient, error: patientError } =
      await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient profile not found." },
        { status: 404 }
      );
    }

    // 5. Fetch the appointment and verify ownership
    const { data: appointment, error: appointmentError } =
      await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          doctor_id,
          appointment_date,
          appointment_time,
          status,
          doctors (
            profiles (
              full_name
            )
          )
        `)
        .eq("id", appointmentId)
        .eq("patient_id", patient.id)
        .maybeSingle();

    if (appointmentError) {
      console.error(
        "RESCHEDULE APPOINTMENT FETCH ERROR:",
        appointmentError
      );

      return NextResponse.json(
        { error: "Unable to retrieve appointment." },
        { status: 500 }
      );
    }

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 }
      );
    }

    if (
      !["scheduled", "confirmed"].includes(
        appointment.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only scheduled or confirmed appointments can be rescheduled.",
        },
        { status: 400 }
      );
    }

    // 6. Check whether the new slot is already occupied
    const {
      data: existingAppointment,
      error: slotError,
    } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", appointment.doctor_id)
      .eq("appointment_date", appointmentDate)
      .eq("appointment_time", appointmentTime)
      .neq("status", "cancelled")
      .neq("id", appointmentId)
      .maybeSingle();

    if (slotError) {
      console.error(
        "RESCHEDULE SLOT CHECK ERROR:",
        slotError
      );

      return NextResponse.json(
        { error: "Unable to check appointment availability." },
        { status: 500 }
      );
    }

    if (existingAppointment) {
      return NextResponse.json(
        {
          error:
            "This time slot is already booked. Please choose another time.",
        },
        { status: 409 }
      );
    }

    // 7. Update appointment
    const { data: updatedAppointment, error: updateError } =
      await supabase
        .from("appointments")
        .update({
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
        })
        .eq("id", appointmentId)
        .eq("patient_id", patient.id)
        .in("status", ["scheduled", "confirmed"])
        .select()
        .maybeSingle();

    if (updateError) {
      console.error(
        "RESCHEDULE UPDATE ERROR:",
        updateError
      );

      return NextResponse.json(
        { error: "Failed to reschedule appointment." },
        { status: 500 }
      );
    }

    if (!updatedAppointment) {
      return NextResponse.json(
        {
          error:
            "Appointment could not be updated. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    // 8. Get doctor name
    const doctor = Array.isArray(appointment.doctors)
      ? appointment.doctors[0]
      : appointment.doctors;

    const doctorProfile = Array.isArray(doctor?.profiles)
      ? doctor.profiles[0]
      : doctor?.profiles;

    const doctorName =
      doctorProfile?.full_name || "your doctor";

    // 9. Notify patient
    try {
      await createCommunicationNotification({
        recipientUserId: user.id,
        type: "appointment_rescheduled",
        appointmentId: appointment.id,
        source: "appointment_rescheduled",
        context:
          `Your appointment with ${doctorName} has been rescheduled ` +
          `from ${appointment.appointment_date} at ${appointment.appointment_time} ` +
          `to ${appointmentDate} at ${appointmentTime}.`,
      });
    } catch (notificationError) {
      console.error(
        "RESCHEDULE NOTIFICATION ERROR:",
        notificationError
      );
    }

    // 10. Return success
    return NextResponse.json({
      success: true,
      appointment: updatedAppointment,
      message:
        `Your appointment with ${doctorName} has been rescheduled ` +
        `to ${appointmentDate} at ${appointmentTime}.`,
    });

  } catch (error) {
    console.error("RESCHEDULE API ERROR:", error);

    return NextResponse.json(
      { error: "Failed to reschedule appointment." },
      { status: 500 }
    );
  }
}