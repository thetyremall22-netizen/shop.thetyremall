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

export function MicButton({
  onResult,
  onInterim,
  title = "Search by voice",
  className = "",
  size = 18,
}: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  title?: string;
  className?: string;
  size?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getCtor());
    return () => { try { recRef.current?.stop(); } catch {} };
  }, []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) { setSupported(false); return; }
    try {
      const rec = new Ctor();
      rec.lang = "en-ZA";
      rec.interimResults = !!onInterim;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.onresult = (e: SpeechResultEvent) => {
        let finalT = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalT += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim && onInterim) onInterim(interim);
        if (finalT) onResult(finalT.trim());
      };
      recRef.current = rec;
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stop() {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }

  // Hidden entirely on browsers without speech recognition (Firefox, some
  // in-app webviews) — the on-screen keyboard's own mic still works there.
  if (!supported) return null;

  return (
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
  );
}
