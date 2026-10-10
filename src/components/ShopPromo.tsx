import { RotatingHeadline } from "./RotatingHeadline";

export function ShopPromo() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(110deg,#101316,#15181c_60%,#101316)] px-5 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(70%_120%_at_85%_40%,rgba(138,197,63,0.12),transparent_65%)]" />
        <span className="light-streak" style={{ right: "14%", top: "-24%", width: 6, height: "150%", opacity: 0.35 }} />
      </div>
      <div className="relative">
        <RotatingHeadline />
      </div>
    </div>
  );
}
