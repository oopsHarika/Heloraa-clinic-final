
"use client";

import { useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type ProfileMenuProps = {
  name?: string | null;
  canEdit?: boolean;
};

export default function ProfileMenu({
  name,
  canEdit = false,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);

  const initial = name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A0D14] text-sm font-semibold text-white hover:opacity-80"
      >
        {initial}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close profile menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-50 mt-3 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">
                {name || "User"}
              </p>
            </div>

            {canEdit && (
              <Link
                href="/patient/onboarding?edit=1"
                onClick={() => setOpen(false)}
                className="mt-2 block rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Edit Profile
              </Link>
            )}

            <div className="mt-1">
              <LogoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
