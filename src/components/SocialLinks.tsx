import type { SiteSettings } from "@/lib/settings";

type P = { className?: string };
const Facebook = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" className={className} aria-hidden>
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
  </svg>
);
const Instagram = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const TikTok = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" className={className} aria-hidden>
    <path d="M16.6 3c.3 2.3 1.7 3.8 4 4v3.1c-1.5.1-2.9-.4-4-1.2v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.2a2.6 2.6 0 1 0 1.8 2.4V3h3z" />
  </svg>
);
const YouTube = ({ className }: P) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" className={className} aria-hidden>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  </svg>
);

/** Turn "thetyremall" or "facebook.com/thetyremall" into a full https link.
 *  Regular https links open the Facebook/Instagram/TikTok/YouTube app on phones
 *  that have it installed, and the website everywhere else. */
function toUrl(raw: string, base: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.(com|net)\//i.test(v)) return `https://${v}`;
  return `${base}${v.replace(/^@/, "")}`;
}

export function SocialLinks({ social, className = "" }: { social: SiteSettings["social"]; className?: string }) {
  const links = [
    { k: "facebook", label: "Facebook", Icon: Facebook, href: toUrl(social.facebook, "https://www.facebook.com/") },
    { k: "instagram", label: "Instagram", Icon: Instagram, href: toUrl(social.instagram, "https://www.instagram.com/") },
    { k: "tiktok", label: "TikTok", Icon: TikTok, href: toUrl(social.tiktok, "https://www.tiktok.com/@") },
    { k: "youtube", label: "YouTube", Icon: YouTube, href: toUrl(social.youtube, "https://www.youtube.com/@") },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map(({ k, label, Icon, href }) => (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={`The Tyre Mall on ${label}`} title={label}
          className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-line transition-colors hover:text-volt">
          <Icon />
        </a>
      ))}
    </div>
  );
}
