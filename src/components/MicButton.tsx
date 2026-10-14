"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "./icons";

// Minimal typing for the Web Speech API (not in the default TS DOM lib).
interface SpeechAlternative { transcript: string }
interface SpeechResult extends ArrayLike<SpeechAlternative> { isFinal: boolean }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onresult: ((e: SpeechResultEvent) => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Chrome allows only ONE active SpeechRecognition on a page at a time. If a
// previous one (e.g. the header search mic) is still winding down when another
// mic (e.g. Tyrone's) starts, the new one fails silently with no transcript.
// Track the active instance globally and abort it before starting a new one.
let activeRec: SpeechRecognitionLike | null = null;

const MSG: Record<string, string> = {
  "not-allowed": "Allow microphone access to search by voice.",
  "service-not-allowed": "Allow microphone access to search by voice.",
  "no-speech": "Didn’t catch that — tap and try again.",
  "audio-capture": "No microphone found on this device.",
  network: "Voice search needs an internet connection.",
  denied: "Allow microphone access to search by voice.",
  unsupported: "Voice search isn’t supported in this browser — try Chrome.",
};

export function MicButton({
  onResult,
  onInterim,
  title = "Search by voice",
  className = "",
  size = 18,
  notePlacement = "bottom",
}: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  title?: string;
  className?: string;
  size?: number;
  /** Where the status note sits relative to the button. Use "top" when the
   *  button is near the bottom of the screen (e.g. the Tyrone chat) so the
   *  message isn't cut off below the viewport. */
  notePlacement?: "top" | "bottom";
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotResult = useRef(false);

  useEffect(() => {
    setSupported(!!getCtor());
    return () => {
      try { recRef.current?.abort(); } catch {}
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  function flash(msg: string) {
    setNote(msg);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 3500);
  }

  function begin() {
    const Ctor = getCtor();
    if (!Ctor) { setSupported(false); flash(MSG.unsupported); return; }
    // Make sure no other mic instance is holding recognition (see activeRec).
    if (activeRec) { try { activeRec.abort(); } catch {} activeRec = null; }
    try {
      const rec = new Ctor();
      rec.lang = "en-ZA";
      rec.interimResults = !!onInterim;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      gotResult.current = false;
      rec.onstart = () => { setNote(null); setListening(true); };
      rec.onend = () => {
        setListening(false);
        if (activeRec === rec) activeRec = null;
        if (!gotResult.current && !note) {
          console.warn("[MicButton] recognition ended with no transcript");
          flash(MSG["no-speech"]);
        }
      };
      rec.onerror = (e) => {
        setListening(false);
        if (activeRec === rec) activeRec = null;
        console.warn("[MicButton] recognition error:", e.error);
        flash(MSG[e.error ?? ""] ?? "Voice search couldn’t start — tap to retry.");
      };
      rec.onresult = (e: SpeechResultEvent) => {
        let finalT = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalT += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim && onInterim) onInterim(interim);
        if (finalT) { gotResult.current = true; onResult(finalT.trim()); }
      };
      recRef.current = rec;
      activeRec = rec;
      rec.start();
    } catch (err) {
      setListening(false);
      activeRec = null;
      console.warn("[MicButton] start threw:", err);
      flash("Voice search couldn’t start — tap to retry.");
    }
  }

  // Start recognition synchronously inside the click/tap. The Web Speech API
  // requires recognition.start() to run in the user-gesture context; an `await`
  // before it (e.g. getUserMedia) loses that gesture on Safari/iOS and the mic
  // silently did nothing. The browser shows its own mic-permission prompt, and
  // onerror ("not-allowed") reports it if the user blocks it.
  function start() {
    begin();
  }

  function stop() {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }

  // Hidden entirely on browsers without speech recognition (e.g. Firefox).
  if (!supported) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={listening ? stop : start}
        title={listening ? "Listening… tap to stop" : title}
        aria-label={title}
        aria-pressed={listening}
        className={`relative grid shrink-0 place-items-center transition-colors ${listening ? "text-sale" : "text-muted hover:text-volt"} ${className}`}
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-sale/25" />}
        <Mic width={size} height={size} />
      </button>
      {note && (
        <div
          className={`absolute right-0 z-50 w-48 rounded-lg bg-ink-2 px-3 py-2 text-[11px] font-medium leading-snug text-fg shadow-xl ring-1 ring-line ${
            notePlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {note}
        </div>
      )}
    </div>
  );
}
