import type { ReactNode } from "react";

/** Short admin-written text where [words](https://address) becomes a link
 *  (e.g. the footer credit). Website addresses open in a new tab. */
export function LinkedText({ text, linkClassName = "underline hover:text-volt" }: { text: string; linkClassName?: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:|tel:)[^\s)]+)\)/g;
  let last = 0, n = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const external = /^https?:/i.test(m[2]);
    out.push(<a key={n++} href={m[2]} className={linkClassName} {...(external ? { target: "_blank", rel: "noopener" } : {})}>{m[1]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
