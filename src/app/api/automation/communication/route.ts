
import { NextResponse } from "next/server";
import { createCommunicationNotification } from "@/lib/notifications/communication";

export async function POST(request: Request) {
  try {
    // 1. Verify n8n authorization
    const expectedToken = process.env.AUTOMATION_SECRET;
    const authHeader = request.headers.get("authorization");

    if (
      !expectedToken ||
      authHeader !== `Bearer ${expectedToken}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Validate request
    const body = await request.json();

    const {
      recipientUserId,
      type = "general",
      context,
      appointmentId,
    } = body;

    if (
      typeof recipientUserId !== "string" ||
      !recipientUserId.trim()
    ) {
      return NextResponse.json(
        { error: "recipientUserId is required." },
        { status: 400 }
      );
    }

    if (
      typeof context !== "string" ||
      !context.trim()
    ) {
      return NextResponse.json(
        { error: "context is required." },
        { status: 400 }
      );
    }

    if (typeof type !== "string" || !type.trim()) {
      return NextResponse.json(
        { error: "A valid notification type is required." },
        { status: 400 }
      );
    }

    if (
      appointmentId !== undefined &&
      (typeof appointmentId !== "string" ||
        !appointmentId.trim())
    ) {
      return NextResponse.json(
        { error: "appointmentId must be a non-empty string." },
        { status: 400 }
      );
    }

    // 3. Generate and save notification using shared helper
    const result = await createCommunicationNotification({
      recipientUserId: recipientUserId.trim(),
      type: type.trim(),
      context: context.trim(),
      appointmentId,
      source: "n8n_automation",
    });

    // 4. Return result
    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      message: result.message ?? "Notification already exists.",
      notification: result.notification,
    });
  } catch (error) {
    console.error("AUTOMATION COMMUNICATION ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate communication.",
      },
      { status: 500 }
    );
  }
}
