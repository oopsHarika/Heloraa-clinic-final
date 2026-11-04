
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { createCommunicationNotification } from "@/lib/notifications/communication";

// ============================================================
// GET — Used by n8n to retrieve tomorrow's appointments
// ============================================================

export async function GET(request: Request) {
  try {
    // 1. Verify n8n authorization

    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.AUTOMATION_SECRET;

    if (
      !expectedToken ||
      authHeader !== `Bearer ${expectedToken}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Use admin client

    const supabase = createAdminClient();

    // 3. Calculate tomorrow's date in India

    const now = new Date();

    const indiaDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = indiaDate.find(
      (part) => part.type === "year"
    )?.value;

    const month = indiaDate.find(
      (part) => part.type === "month"
    )?.value;

    const day = indiaDate.find(
      (part) => part.type === "day"
    )?.value;

    if (!year || !month || !day) {
      throw new Error("Unable to determine current date.");
    }

    const today = new Date(
      `${year}-${month}-${day}T00:00:00+05:30`
    );

    today.setDate(today.getDate() + 1);

    const tomorrowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(today);

    const tomorrowYear = tomorrowParts.find(
      (part) => part.type === "year"
    )?.value;

    const tomorrowMonth = tomorrowParts.find(
      (part) => part.type === "month"
    )?.value;

    const tomorrowDay = tomorrowParts.find(
      (part) => part.type === "day"
    )?.value;

    const tomorrow = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

    // 4. Get tomorrow's scheduled appointments

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        appointment_type,
        reason,
        status,

        patients (
          id,
          profile_id,
          profiles (
            full_name,
            email
          )
        ),

        doctors (
          id,
          specialization,
          profiles (
            full_name,
            email
          )
        )
      `)
      .eq("appointment_date", tomorrow)
      .eq("status", "scheduled")
      .order("appointment_time", {
        ascending: true,
      });

    if (error) {
      console.error(
        "AUTOMATION APPOINTMENTS ERROR:",
        error
      );

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 5. Return appointments to n8n

    return NextResponse.json({
      success: true,
      date: tomorrow,
      count: appointments?.length || 0,
      appointments: appointments || [],
    });

  } catch (error) {
    console.error(
      "GET AUTOMATION APPOINTMENTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve tomorrow's appointments.",
      },
      { status: 500 }
    );
  }
}


// ============================================================
// POST — Used by the patient booking page
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Get logged-in user

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in to book an appointment.",
        },
        { status: 401 }
      );
    }

    // 2. Read request body

    const body = await request.json();

    const {
      doctorId,
      appointmentDate,
      appointmentTime,
      appointmentType,
      reason,
    } = body;

    if (
      !doctorId ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return NextResponse.json(
        {
          error:
            "Doctor, appointment date and appointment time are required.",
        },
        { status: 400 }
      );
    }

    // 3. Get patient profile

    const { data: patient, error: patientError } =
      await supabase
        .from("patients")
        .select("id, profile_id")
        .eq("profile_id", user.id)
        .single();

    if (patientError || !patient) {
      console.error("PATIENT ERROR:", patientError);

      return NextResponse.json(
        { error: "Patient profile not found." },
        { status: 404 }
      );
    }

    // 4. Verify doctor exists

    const { data: doctor, error: doctorError } =
      await supabase
        .from("doctors")
        .select(`
          id,
          specialization,
          profiles (
            full_name
          )
        `)
        .eq("id", doctorId)
        .single();

    if (doctorError || !doctor) {
      console.error("DOCTOR ERROR:", doctorError);

      return NextResponse.json(
        {
          error: "Selected doctor could not be found.",
        },
        { status: 404 }
      );
    }

    // 5. Check duplicate appointment slot

    const {
      data: existingAppointment,
      error: existingError,
    } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("appointment_date", appointmentDate)
      .eq("appointment_time", appointmentTime)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingError) {
      console.error(
        "APPOINTMENT CHECK ERROR:",
        existingError
      );

      return NextResponse.json(
        { error: existingError.message },
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

    // 6. Create appointment

    const {
      data: appointment,
      error: appointmentError,
    } = await supabase
      .from("appointments")
      .insert({
        patient_id: patient.id,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        appointment_type:
          appointmentType || "consultation",
        reason:
          reason || "General consultation",
        status: "scheduled",
      })
      .select()
      .single();

    if (appointmentError) {
      console.error(
        "APPOINTMENT INSERT ERROR:",
        appointmentError
      );

      return NextResponse.json(
        { error: appointmentError.message },
        { status: 500 }
      );
    }

    // 7. Get doctor name

    const doctorProfile = Array.isArray(doctor.profiles)
      ? doctor.profiles[0]
      : doctor.profiles;

    const doctorName =
      doctorProfile?.full_name || "Selected doctor";

    // 8. Create appointment confirmation notification

    try {
      await createCommunicationNotification({
        recipientUserId: user.id,
        type: "appointment_confirmation",
        appointmentId: appointment.id,
        source: "appointment_booking",
        context: `Your appointment with ${doctorName} has been booked for ${appointmentDate} at ${appointmentTime}.`,
      });
    } catch (notificationError) {
      console.error(
        "BOOKING NOTIFICATION ERROR:",
        notificationError
      );
    }

    // 9. Return successful booking response

    return NextResponse.json(
      {
        success: true,
        appointment,
        confirmation: `Your consultation with ${doctorName} has been booked for ${appointmentDate} at ${appointmentTime}.`,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(
      "APPOINTMENT API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to book appointment.",
      },
      { status: 500 }
    );
  }
}
