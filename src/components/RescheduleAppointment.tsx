
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  appointmentId: string;
  currentDate: string;
  currentTime: string;
};

export default function RescheduleAppointment({
  appointmentId,
  currentDate,
  currentTime,
}: Props) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime.slice(0, 5));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Use the browser's local calendar date.
  const today = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  async function handleReschedule() {
    setError("");
    setSuccess("");

    if (!date || !time) {
      setError("Please select a new date and time.");
      return;
    }

    if (date < today) {
      setError("Please select today or a future date.");
      return;
    }

    if (date === currentDate && time === currentTime.slice(0, 5)) {
      setError("Please choose a different date or time.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/appointments/reschedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointmentId,
            appointmentDate: date,
            appointmentTime: time,
          }),
        }
      );

      const raw = await response.text();

      let data: {
        error?: string;
        message?: string;
      } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to reschedule appointment.");
      }

      setSuccess(data.message || "Appointment rescheduled successfully.");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reschedule appointment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setDate(currentDate);
            setTime(currentTime.slice(0, 5));
            setIsOpen(true);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Reschedule
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-[#0A0D14]">
            Choose a new appointment time
          </h4>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`reschedule-date-${appointmentId}`}
                className="text-xs font-medium text-slate-600"
              >
                New date
              </label>

              <input
                id={`reschedule-date-${appointmentId}`}
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor={`reschedule-time-${appointmentId}`}
                className="text-xs font-medium text-slate-600"
              >
                New time
              </label>

              <input
                id={`reschedule-time-${appointmentId}`}
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {success && (
            <p className="mt-3 text-sm text-emerald-700">{success}</p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleReschedule}
              disabled={loading}
              className="rounded-lg bg-[#0A0D14] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Rescheduling..." : "Confirm new time"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
