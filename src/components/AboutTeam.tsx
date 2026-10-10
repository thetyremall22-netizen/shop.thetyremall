import { Reveal } from "./Reveal";

const STATS = [
  { n: "10", l: "Years rolling" },
  { n: "7,000+", l: "Tyres in range" },
  { n: "26", l: "Top brands" },
  { n: "SA-wide", l: "Free delivery" },
];

// Placeholder team avatars — swap for real photos + names when supplied.
const TEAM = Array.from({ length: 6 });

export function AboutTeam() {
  return (
    <section className="container-x py-14">
      {/* our story */}
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Reveal variant="left">
          <div>
            <span className="eyebrow">Proudly South African</span>
            <h2 className="skew-italic mt-1 font-display text-4xl leading-none sm:text-5xl">
              <span className="text-chrome">OUR</span> <span className="text-volt-grad">STORY</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              For the past 10 years, The Tyre Mall has been dedicated to providing quality tyres,
              expert service and unbeatable value. Since our founding we&apos;ve built a reputation for
              reliability — making sure every driver finds the perfect tyres for their journey. Whether
              it&apos;s performance, durability or affordability you&apos;re after, we&apos;re here to keep
              you rolling with confidence.
            </p>
          </div>
        </Reveal>
        <Reveal variant="zoom">
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.l} className="card glow-hover flex flex-col items-center justify-center py-7 text-center">
                <div className="font-display text-4xl text-volt sm:text-5xl">{s.n}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* meet the team */}
      <div className="mt-14">
        <Reveal>
          <div className="text-center">
            <span className="eyebrow">The faces behind your tyres</span>
            <h2 className="skew-italic mt-1 font-display text-4xl leading-none sm:text-5xl">
              <span className="text-chrome">MEET THE</span> <span className="text-volt-grad">TEAM</span>
            </h2>
          </div>
        </Reveal>
        <div className="mt-8 flex flex-wrap items-start justify-center gap-6 sm:gap-10">
          {TEAM.map((_, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="flex w-24 flex-col items-center gap-2">
                <div className="glow-hover grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#1b1f24,#0e1114)] ring-1 ring-line">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8ac53f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
                  </svg>
                </div>
                <div className="h-2.5 w-14 rounded bg-line" />
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Team photos &amp; names coming soon.</p>
      </div>
    </section>
  );
}
