/** Branded loading indicator — a spinning tyre with a volt-green rim.
 *  Used by route-level loading.tsx screens and anywhere a short wait needs a
 *  on-brand spinner. `size` is the SVG px; `label` shows under it (and is read
 *  out to screen readers). */
export function TyreSpinner({
  size = 72,
  label,
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status" aria-live="polite">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="tyre-spin"
        aria-hidden="true"
        fill="none"
      >
        {/* rubber */}
        <circle cx="50" cy="50" r="42" stroke="#14161a" strokeWidth="14" />
        {/* tread blocks (asymmetric so the spin reads) */}
        <circle
          cx="50"
          cy="50"
          r="47"
          stroke="#0a0b0d"
          strokeWidth="5"
          strokeDasharray="4 6"
        />
        {/* rim lip */}
        <circle cx="50" cy="50" r="30" stroke="#c7ccd1" strokeWidth="3" />
        {/* volt accent ring */}
        <circle cx="50" cy="50" r="26" stroke="#8ac53f" strokeWidth="2" opacity="0.9" />
        {/* spokes */}
        <g stroke="#8ac53f" strokeWidth="4" strokeLinecap="round">
          <line x1="50" y1="50" x2="50" y2="26" />
          <line x1="50" y1="50" x2="70.8" y2="62" />
          <line x1="50" y1="50" x2="29.2" y2="62" />
        </g>
        {/* hub */}
        <circle cx="50" cy="50" r="7" fill="#8ac53f" />
        <circle cx="50" cy="50" r="3" fill="#0a0b0d" />
      </svg>
      {label && <span className="text-sm font-semibold tracking-wide text-muted">{label}</span>}
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}

/** Full-section centered spinner for route-level loading.tsx screens. */
export function TyreSpinnerScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <TyreSpinner size={88} label={label} />
    </div>
  );
}
