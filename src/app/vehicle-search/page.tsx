import type { Metadata } from "next";
import { VehicleSearch } from "@/components/VehicleSearch";

export const metadata: Metadata = {
  title: "Find Tyres by Vehicle — Make, Model, Year",
  description:
    "Find the right tyres for your car, SUV or bakkie at The Tyre Mall. Pick your make, model, year and trim to see the factory and optional sizes, then shop with free nationwide delivery.",
  alternates: { canonical: "/vehicle-search" },
};

export default function VehicleSearchPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      <div className="max-w-2xl">
        <span className="eyebrow">Find your perfect fit</span>
        <h1 className="skew-italic mt-1 font-display text-5xl leading-[0.9] sm:text-7xl">
          <span className="text-chrome">FIND TYRES BY</span> <span className="text-volt-grad">VEHICLE</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          Pick your <strong className="text-fg">make, model, year and trim</strong> — The Tyre Mall will show the
          factory fitment and optional sizes. We list a factory size for over 98.9% of vehicles on South African roads.
        </p>
      </div>

      <div className="mt-8">
        <VehicleSearch />
      </div>
    </div>
  );
}
