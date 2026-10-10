"use client";

import { useEffect, useState } from "react";
import { Star } from "./icons";

// Real customer reviews from The Tyre Mall.
const REVIEWS = [
  { name: "Gavin Hancock", text: "Two tyres delivered at no extra charge within 3–4 days. Best service ever." },
  { name: "Waheed Swales", text: "Needed a specific tyre with fitment at my nearest branch — sorted swiftly. 3rd purchase, all smooth." },
  { name: "Morgan Malyon", text: "Basically the cheapest option. Ordered late afternoon, delivered before 10am. Highly recommend!" },
  { name: "Gillian Cuturi", text: "5-star service and price. Wonderful experience — went out of their way to help." },
  { name: "Mohammed Shah", text: "Good prices, great service, and after-sales care to boot." },
  { name: "Jorge", text: "Great prices and fast delivery. Kept updated via email. Supporting them over the overpriced shops." },
  { name: "Dwayne De Lange", text: "Helped immediately and went over and above to get me the tyres I wanted. Thanks, guys!" },
];

const PER_PAGE = 4;

export function RotatingReviews() {
  const [start, setStart] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStart((s) => (s + 2) % REVIEWS.length), 4500);
    return () => clearInterval(t);
  }, []);

  const visible = Array.from({ length: PER_PAGE }, (_, i) => REVIEWS[(start + i) % REVIEWS.length]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((r, i) => (
        <figure
          key={`${start}-${i}-${r.name}`}
          className="review-in card flex h-full flex-col p-5"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <div className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star key={j} width={15} height={15} />
            ))}
          </div>
          <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-fg">“{r.text}”</blockquote>
          <figcaption className="mt-3 text-xs font-semibold text-muted">— {r.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
