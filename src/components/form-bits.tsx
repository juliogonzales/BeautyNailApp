"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-sand bg-white px-3 py-2.5 text-base text-graphite placeholder:text-graphite/50 focus:outline-none focus:ring-2 focus:ring-cocoa";

export function SubmitButton({ children, pendingLabel = "Aguarde…" }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cocoa px-4 py-3 font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-800">
      {messages[0]}
    </p>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-lg border border-sand bg-nude px-3 py-2 text-sm text-cocoa">
        {message}
      </p>
    );
  }
  return null;
}
