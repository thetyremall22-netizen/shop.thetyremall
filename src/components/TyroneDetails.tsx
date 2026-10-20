"use client";

import { useEffect, useState, type FormEvent } from "react";
import { validateContact, type ContactErrors } from "@/lib/validate";
import { loadSavedContact, storeSavedContact, type SavedContact } from "@/lib/saved-contact";
import { GateField } from "./WhatsAppGate";

/** Shown inside the Tyrone panel before the chat starts: a valid name, email
 *  and mobile are required, saved to Admin → Leads (Tyrone chat tab) and
 *  emailed to the shop, so the team can always follow up. */
export function TyroneDetails({ onDone }: { onDone: (c: SavedContact) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});

  useEffect(() => {
    const s = loadSavedContact();
    setName(s.name); setEmail(s.email); setPhone(s.phone);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const { errors: errs, clean } = validateContact({ name, email, phone }, { name: true, email: true, phone: true });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const c = clean as SavedContact;
    // Fire-and-forget; the server re-checks the same rules.
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "tyrone", ...c, message: "Started a chat with Tyrone" }),
      keepalive: true,
    }).catch(() => {});
    storeSavedContact(c);
    onDone(c);
  }

  return (
    <form onSubmit={submit} noValidate className="flex-1 overflow-y-auto p-4">
      <div className="rounded-2xl rounded-bl-sm bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-fg">
        Hi, I&apos;m Tyrone 👋 Before we chat, please share your name, email and mobile — in case we lose signal and need to contact you.
      </div>
      <GateField label="Your name" value={name} onChange={setName} error={errors.name} autoComplete="name" placeholder="Your name" autoFocus />
      <GateField label="Email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" type="email" inputMode="email" placeholder="you@gmail.com" />
      <GateField label="Mobile number" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" type="tel" inputMode="tel" placeholder="082 123 4567" />
      <button type="submit" className="btn btn-volt mt-5 h-11 w-full justify-center">Start chatting</button>
    </form>
  );
}
