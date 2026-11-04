
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateWithOpenRouter } from "@/lib/ai/provider";

type CreateCommunicationNotificationParams = {
  recipientUserId: string;
  type: string;
  context: string;
  appointmentId?: string;
  source:
  | "appointment_booking"
  | "appointment_cancellation"
  | "appointment_rescheduled"
  | "n8n_automation";
};

export async function createCommunicationNotification({
  recipientUserId,
  type,
  context,
  appointmentId,
  source,
}: CreateCommunicationNotificationParams) {
  const supabase = createAdminClient();

  const { data: recipient, error: recipientError } =
    await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", recipientUserId)
      .single();

  if (recipientError || !recipient) {
    throw new Error("Notification recipient not found.");
  }

  let message: string;

  try {
    message = await generateWithOpenRouter({
      systemInstruction: `
You are the Communication Agent for Heloraa Clinic.

Create a short, professional healthcare notification.

Rules:
- Be concise, calm and professional.
- Do not diagnose or provide treatment advice.
- Do not invent information.
- Use only the supplied context.
- Return only the notification message.
      `,
      prompt: `
Recipient: ${recipient.full_name}
Communication type: ${type}
Context: ${context}
      `,
      temperature: 0.2,
      maxOutputTokens: 250,
    });

    if (!message?.trim()) {
      throw new Error("AI returned an empty notification.");
    }
  } catch (error) {
    console.error("COMMUNICATION AI ERROR:", error);

    message = context;
  }

  const metadata: Record<string, string> = {
    generated_by: "communication_agent",
    source,
  };

  if (appointmentId) {
    metadata.appointment_id = appointmentId;
    metadata.event = type;
  }

  const { data: notification, error: notificationError } =
    await supabase
      .from("notifications")
      .insert({
        user_id: recipient.id,
        title: getNotificationTitle(type),
        message,
        type,
        read: false,
        metadata,
      })
      .select()
      .single();

  if (notificationError) {
    if (notificationError.code === "23505") {
      return {
        success: true,
        duplicate: true,
        notification: null,
      };
    }

    throw new Error(notificationError.message);
  }

  const { error: interactionError } = await supabase
    .from("ai_interactions")
    .insert({
      user_id: recipient.id,
      patient_id: null,
      agent_name: "communication",
      input_text: JSON.stringify({
        recipientUserId,
        type,
        context,
        appointmentId,
      }),
      output_text: message,
      metadata: {
        provider: "openrouter",
        model:
          process.env.OPENROUTER_MODEL ||
          "inclusionai/ling-3.0-flash-sante:free",
        rag: false,
        source,
        notification_id: notification.id,
      },
    });

  if (interactionError) {
    console.warn(
      "AI interaction logging failed:",
      interactionError.message
    );
  }

  return {
    success: true,
    duplicate: false,
    message,
    notification,
  };
}

function getNotificationTitle(type: string) {
  switch (type) {
    case "appointment_reminder":
      return "Appointment Reminder";
    case "appointment_confirmation":
      return "Appointment Confirmed";
    case "appointment_cancellation":
      return "Appointment Cancelled";
    case "appointment_rescheduled":
      return "Appointment Rescheduled";
    case "follow_up":
      return "Follow-up Reminder";
    case "report_ready":
      return "Report Available";
    case "doctor_message":
      return "Message from Doctor";
    default:
      return "Heloraa Clinic";
  }
}
