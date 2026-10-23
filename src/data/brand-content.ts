// Write-ups for the brand landing pages at /brand/<brand-slug>/.
// Keyed by brand slug (lower-case, dashes). Keep facts conservative: well-known
// history for the big brands; for value brands, describe what we stock rather
// than claims we can't check. A brand with products but no entry here still
// gets a page, with a write-up built from the stock (see src/app/brand/[slug]).

export interface BrandCopy {
  /** Display name, when it isn't just the slug capitalised (e.g. "CEAT"). */
  name?: string;
  /** Short line under the heading. */
  tagline: string;
  /** "About <brand>" paragraphs. */
  about: string[];
  /** Tyre ranges we stock, as name → one-line description. */
  ranges?: { name: string; text: string }[];
  /** Mag wheel brand (not tyres). */
  wheels?: boolean;
}

export const BRAND_CONTENT: Record<string, BrandCopy> = {
  bridgestone: {
    tagline: "Japan's tyre giant — premium grip, comfort and mileage for every kind of vehicle.",
    about: [
      "Bridgestone was founded in 1931 in Kurume, Japan, by Shojiro Ishibashi — the name is a translation of his surname, which means \"stone bridge\". Today it's one of the largest tyre makers in the world, and it also owns the Firestone brand.",
      "Bridgestone tyres are fitted as original equipment by many of the world's car makers, from city hatchbacks to performance cars, SUVs and bakkies. Whatever you drive, there's a Bridgestone built for it — from quiet, long-lasting touring tyres to sharp-handling performance tyres and tough 4x4 rubber.",
    ],
    ranges: [
      { name: "Potenza (RE050, S001, Adrenalin RE003)", text: "Performance tyres for precise steering and strong grip, wet or dry." },
      { name: "Turanza (T001, T005)", text: "Comfortable, quiet touring tyres with excellent wet braking." },
      { name: "Ecopia (EP850)", text: "Low rolling resistance for better fuel economy and long tread life." },
      { name: "Dueler & Alenza (D697, H/T, A/T, Alenza 001)", text: "SUV and 4x4 tyres — on-road comfort or all-terrain toughness." },
      { name: "Run-flat (RFT) sizes", text: "Keep driving after a puncture — common on BMW, Mercedes-Benz and other premium cars." },
    ],
  },
  pirelli: {
    tagline: "Italian performance, proven in Formula 1 — the choice of the world's prestige car makers.",
    about: [
      "Pirelli was founded in Milan, Italy, in 1872 by Giovanni Battista Pirelli. It's best known for high-performance tyres and is the sole tyre supplier to Formula 1, with that racing know-how going straight into its road tyres.",
      "Many prestige and sports car makers fit Pirelli tyres from the factory, often in versions developed specifically for one car. Look for markings such as MO (Mercedes-Benz), N0/N1 (Porsche), ★ (BMW), J (Jaguar) or L (Lamborghini) — matching the marking keeps your car handling exactly as its maker intended.",
    ],
    ranges: [
      { name: "P Zero", text: "Pirelli's flagship ultra-high-performance tyre for sports and luxury cars." },
      { name: "Cinturato P7", text: "Comfortable, efficient touring tyre for everyday sedans and hatchbacks." },
      { name: "Scorpion (incl. ATR)", text: "SUV and 4x4 tyres, from road-focused comfort to all-terrain grip." },
      { name: "Carrier", text: "Strong, long-wearing tyres for vans and light commercial vehicles." },
    ],
  },
  radar: {
    tagline: "Value-packed tyres from a global brand — strong 4x4, SUV and passenger ranges.",
    about: [
      "Radar Tyres is the flagship brand of Omni United, a tyre company headquartered in Singapore. Radar launched in 2006 and is now sold in more than 80 countries, with tyres produced at manufacturing partners in Asia.",
      "Radar is known for giving you a lot of tyre for your money, with an especially popular range of 4x4 and bakkie tyres in South Africa. Selected Radar tyres bought from The Tyre Mall also come with Radar Protect road hazard cover.",
    ],
    ranges: [
      { name: "Dimax (R8, R8+, Sprint, Sport)", text: "Passenger and performance tyres with good grip and a comfortable ride." },
      { name: "Renegade (A/T-5, R/T+, A/T Sport, M/T R7)", text: "4x4 and bakkie tyres — all-terrain, rugged-terrain and mud-terrain." },
      { name: "RPX800", text: "Everyday touring tyre for sedans and hatchbacks." },
      { name: "Commercial & truck sizes", text: "Tyres for vans, light trucks and heavy vehicles." },
    ],
  },
  goodyear: {
    tagline: "American innovation since 1898 — grip, comfort and efficiency you can trust.",
    about: [
      "Goodyear was founded in 1898 in Akron, Ohio, and named after Charles Goodyear, who discovered how to vulcanise rubber. More than a century later it's one of the world's biggest tyre companies, famous for its blimps and its motorsport heritage.",
      "Goodyear tyres are fitted as original equipment on a wide range of cars, SUVs and bakkies. From the Eagle F1 performance family to the long-lasting EfficientGrip and the go-anywhere Wrangler, there's a Goodyear for every driver.",
    ],
    ranges: [
      { name: "Eagle F1 (Asymmetric 3, 5 & 6, SuperSport)", text: "Ultra-high-performance tyres with short braking distances and sharp handling." },
      { name: "EfficientGrip (Performance, 2, Cargo)", text: "Comfortable, fuel-saving tyres with long tread life — Cargo versions for vans." },
      { name: "Wrangler (AT Adventure and more)", text: "SUV and 4x4 tyres built for gravel, tar and everything in between." },
      { name: "Run-flat (ROF) sizes", text: "Drive on after a puncture — for cars that come without a spare." },
    ],
  },
  dunlop: {
    tagline: "The name behind the pneumatic tyre — made for South African roads.",
    about: [
      "The Dunlop name goes back to John Boyd Dunlop, who developed the first practical pneumatic (air-filled) tyre in 1888. In South Africa, Dunlop tyres are made and sold by Sumitomo Rubber South Africa, part of Japan's Sumitomo Rubber Industries, with local manufacturing in Ladysmith, KwaZulu-Natal.",
      "That local focus means Dunlop's ranges are developed and tested with South African conditions in mind — from city commutes to long-distance highway driving and gravel roads. Many Dunlop sizes feature a rim protector (MFS) to help guard your mags against kerb damage.",
    ],
    ranges: [
      { name: "SP Sport Maxx (050+, 060+, GT, TT)", text: "Performance tyres with precise steering and strong wet and dry grip." },
      { name: "Grandtrek (AT5, AT3)", text: "Tough, reliable all-terrain tyres for SUVs, 4x4s and bakkies." },
      { name: "SP Touring / FM800 / LM704", text: "Comfortable, quiet, long-lasting tyres for everyday cars." },
      { name: "Commercial & truck sizes", text: "Hard-working tyres for vans, light trucks and heavy vehicles." },
    ],
  },
  landsail: {
    tagline: "Modern, affordable tyres for cars, SUVs, 4x4s and vans.",
    about: [
      "Landsail is a tyre brand from Sentury Tire, a modern manufacturer based in Qingdao, China, with production in China and Thailand. The brand was introduced in 2010 and is now sold around the world.",
      "Landsail is a smart choice if you want new, quality tyres at a lower price — with a wide range of sizes covering small hatchbacks right through to large SUVs, 4x4s and vans.",
    ],
    ranges: [
      { name: "LS388 / LS288", text: "Comfortable, economical tyres for everyday passenger cars." },
      { name: "LS588 (UHP, SUV)", text: "Performance tyres for sporty cars and SUVs, with good wet grip." },
      { name: "CLV1 / CLV2 / LS988", text: "Highway and SUV tyres for a quiet, stable ride." },
      { name: "CLX-10 / LSV88", text: "Tough tyres for 4x4s, bakkies and vans." },
    ],
  },
  landspider: {
    tagline: "A newer value brand with tyres for city cars, SUVs and 4x4s.",
    about: [
      "Landspider is one of the newer names in tyres, offering quality tyres at a budget-friendly price. Its ranges are split simply: CityTraxx for the road and WildTraxx for off-road.",
      "If you want a fresh set of new tyres without paying premium-brand prices, Landspider is well worth a look — especially for everyday cars, SUVs and 4x4s.",
    ],
    ranges: [
      { name: "CityTraxx H/P & G/P", text: "Road tyres for passenger cars and SUVs, with sporty handling and a comfortable ride." },
      { name: "CityTraxx H/T", text: "Highway-terrain tyres for SUVs, crossovers and bakkies." },
      { name: "WildTraxx A/T", text: "All-terrain tyres for 4x4s that see tar and gravel." },
      { name: "WildTraxx M/T", text: "Aggressive mud-terrain tyres for serious off-road use." },
    ],
  },
  michelin: {
    tagline: "French engineering since 1889 — the benchmark for performance and long life.",
    about: [
      "Michelin was founded in 1889 in Clermont-Ferrand, France, by brothers André and Édouard Michelin. It pioneered the radial tyre, and its famous Michelin Man (Bibendum) is one of the oldest trademarks in the world. Michelin also owns BFGoodrich.",
      "Michelin tyres are known for lasting a long time while keeping their grip right to the end. They're a favourite with sports car makers too — the Pilot Sport family is fitted from the factory to many of the world's fastest cars.",
    ],
    ranges: [
      { name: "Pilot Sport 4 / 4 S / Super Sport", text: "Michelin's ultra-high-performance tyres — superb grip and steering feel." },
      { name: "Pilot Sport Cup 2", text: "Track-capable, road-legal tyres for high-performance cars." },
      { name: "Primacy & Latitude", text: "Comfortable, long-lasting tyres for sedans and SUVs." },
      { name: "Agilis", text: "Durable tyres for vans and light commercial vehicles." },
    ],
  },
  continental: {
    tagline: "German engineering since 1871 — excellent braking and confident handling.",
    about: [
      "Continental was founded in Hanover, Germany, in 1871 and is one of the world's leading tyre and automotive technology companies. It also owns the General Tire brand.",
      "Continental tyres are known for short braking distances and safe, predictable handling, and they're fitted as original equipment by many European car makers. Look out for SSR (Self-Supporting Runflat) sizes and maker markings such as MO (Mercedes-Benz) and ★ (BMW).",
    ],
    ranges: [
      { name: "SportContact (3, 5, 5P, SSR)", text: "Performance tyres for sporty and premium cars, including run-flat versions." },
      { name: "PremiumContact", text: "Comfortable, safe touring tyres with great wet braking." },
      { name: "CrossContact (UHP, LX 2, AT)", text: "SUV and 4x4 tyres from road-focused to all-terrain." },
      { name: "VanContact", text: "Strong, long-lasting tyres for vans and light commercials." },
    ],
  },
  "bfgoodrich": {
    name: "BFGoodrich",
    tagline: "Legendary off-road tyres — the original All-Terrain T/A.",
    about: [
      "BFGoodrich traces its roots back to 1870 in the United States and has been part of the Michelin group since 1990. It's famous for off-road tyres, proven over decades of desert and off-road racing.",
      "The All-Terrain T/A KO2 is one of the most popular 4x4 tyres ever made, trusted by overlanders and bakkie owners across South Africa for its toughness on gravel, rocks and sand, with good manners on tar.",
    ],
    ranges: [
      { name: "All-Terrain T/A KO2 & KO3", text: "Tough, long-lasting all-terrain tyres for 4x4s and bakkies." },
      { name: "Mud-Terrain T/A KM3", text: "Maximum grip in mud and on rocks for serious off-roading." },
      { name: "Road sizes", text: "Selected passenger and SUV sizes for everyday driving." },
    ],
  },
  firestone: {
    tagline: "Trusted American tyres since 1900 — dependable value from the Bridgestone family.",
    about: [
      "Firestone was founded in 1900 by Harvey Firestone in Akron, Ohio, and has been part of Bridgestone since 1988. It offers dependable, well-made tyres at a sensible price, backed by Bridgestone's technology.",
      "From everyday passenger tyres to tough all-terrain rubber for bakkies and SUVs, Firestone is a great middle ground between budget and premium brands.",
    ],
    ranges: [
      { name: "FS100", text: "Comfortable, long-lasting tyres for everyday passenger cars." },
      { name: "Destination A/T & LE-02", text: "All-terrain and highway tyres for SUVs, 4x4s and bakkies." },
      { name: "CV range", text: "Strong tyres for vans and light commercial vehicles." },
    ],
  },
  general: {
    tagline: "Dependable tyres from General Tire, part of the Continental group.",
    about: [
      "General Tire was founded in 1915 in Akron, Ohio, and has been part of Continental since 1987. It makes tough, good-value tyres with Continental's engineering behind them.",
      "General is best known for its Grabber 4x4 tyres and its comfortable Altimax passenger tyres — a great choice if you want quality without premium prices.",
    ],
    ranges: [
      { name: "Altimax (Comfort, Sport)", text: "Quiet, comfortable and long-lasting tyres for everyday cars." },
      { name: "Grabber (AT3 and more)", text: "Rugged all-terrain tyres for SUVs, 4x4s and bakkies." },
    ],
  },
  sumitomo: {
    tagline: "Japanese quality at a sensible price, from Sumitomo Rubber Industries.",
    about: [
      "Sumitomo tyres are made by Sumitomo Rubber Industries of Kobe, Japan — the same company behind the Dunlop and Falken tyre brands in many parts of the world.",
      "Sumitomo offers well-made performance and touring tyres at a lower price than many premium brands, making it a great-value choice for sporty and everyday cars.",
    ],
    ranges: [
      { name: "HTR Z III", text: "Ultra-high-performance tyre for sporty cars." },
      { name: "HTR range (H5, T5, V5, V6, A/S P01)", text: "Comfortable touring and all-season tyres for everyday driving." },
      { name: "Commercial & truck sizes", text: "Tyres for vans, light trucks and buses." },
    ],
  },
  sava: {
    tagline: "European-made value tyres with Goodyear technology.",
    about: [
      "Sava is a tyre brand from Kranj, Slovenia, with a history going back decades, and is part of the Goodyear group. That means you get Goodyear know-how at a more affordable price.",
      "Sava's ranges cover everyday cars, sporty cars and vans — sensible, safe tyres for drivers who want good value from a European brand.",
    ],
    ranges: [
      { name: "Intensa (HP, UHP)", text: "Performance tyres with good grip and handling." },
      { name: "Effecta+ / Perfecta", text: "Comfortable, economical tyres for everyday cars." },
      { name: "Trenta 2", text: "Strong, long-lasting tyres for vans and light commercials." },
    ],
  },
  yokohama: {
    tagline: "Japanese tyre maker since 1917.",
    about: [
      "Yokohama Rubber was founded in Japan in 1917 and is known around the world for quality road, performance and 4x4 tyres, including its ADVAN and Geolandar ranges.",
      "Looking for a specific Yokohama tyre? Ask us about sizes, availability and pricing — we'll help you find the right one.",
    ],
  },
  nexen: {
    tagline: "Korean tyre maker with modern, good-value tyres.",
    about: [
      "Nexen Tire is a South Korean tyre manufacturer that supplies tyres to car makers and drivers around the world, offering modern designs at a competitive price.",
      "Looking for a specific Nexen tyre? Ask us about sizes, availability and pricing — we'll help you find the right one.",
    ],
  },
  ceat: {
    name: "CEAT",
    tagline: "Tough, good-value tyres from India's CEAT.",
    about: [
      "CEAT is one of India's leading tyre manufacturers, making tyres for cars, commercial vehicles and motorcycles that are sold in many countries.",
      "Looking for a specific CEAT tyre? Ask us about sizes, availability and pricing — we'll help you find the right one.",
    ],
  },
  tracmax: {
    tagline: "Affordable tyres with a big size range — cars, SUVs, 4x4s and vans.",
    about: [
      "Tracmax is a value tyre brand made in China and sold internationally. It covers a large range of sizes, from small hatchbacks to SUVs, 4x4s, vans and trucks.",
      "If you need reliable new tyres on a budget, Tracmax is a popular choice — its X-Privilo range in particular offers a lot of tyre for the price.",
    ],
    ranges: [
      { name: "X-Privilo TX3 / TX5", text: "Performance and touring tyres for cars and SUVs." },
      { name: "X-Privilo H/T", text: "Highway tyres for SUVs and bakkies." },
      { name: "Transporter RF09 & van sizes", text: "Strong tyres for vans and light commercial vehicles." },
      { name: "Truck sizes", text: "Budget-friendly tyres for heavy vehicles." },
    ],
  },
  windforce: {
    tagline: "Value tyres for cars, SUVs, 4x4s, trucks and buses.",
    about: [
      "Windforce is a value tyre brand from China's Shandong province, a major tyre-making region. It makes radial tyres for cars, SUVs, 4x4s, trucks and buses.",
      "Windforce's Catchfors family covers most everyday needs at a very competitive price — a good option when you want a safe, new tyre without the premium-brand cost.",
    ],
    ranges: [
      { name: "Catchfors H/P & PCR", text: "Comfortable, economical tyres for everyday passenger cars." },
      { name: "Catchfors UHP (Z, Pro)", text: "Performance tyres for sporty cars and larger rims." },
      { name: "Catchfors H/T & A/T", text: "Highway and all-terrain tyres for SUVs, 4x4s and bakkies." },
      { name: "Truck & bus sizes", text: "Hard-working tyres for heavy vehicles." },
    ],
  },
  kapsen: {
    tagline: "Budget-friendly tyres from cars to trucks.",
    about: [
      "Kapsen is a value tyre brand made in China's Shandong province and sold in many countries. Its range covers passenger cars, SUVs, 4x4s, vans, and trucks and buses.",
      "Kapsen tyres are a popular choice for drivers and fleet owners who need dependable new tyres at a low price.",
    ],
    ranges: [
      { name: "S2000 / S801", text: "Sporty and everyday tyres for passenger cars." },
      { name: "RS01, RS21–RS26", text: "Tyres for SUVs, 4x4s and bakkies." },
      { name: "Truck & bus sizes (HS205 and more)", text: "Long-wearing tyres for heavy vehicles." },
    ],
  },
  annaite: {
    tagline: "Affordable everyday tyres for cars and vans.",
    about: [
      "Annaite is a value tyre brand with a focus on everyday passenger car and van sizes. It's a good option when you want a new tyre at a low price.",
    ],
    ranges: [
      { name: "AN600", text: "Comfortable, economical tyre for small and mid-size cars." },
      { name: "AN606 / AN616 / AN668", text: "Tyres for sportier cars and bigger rims." },
      { name: "AN900", text: "Strong tyre for vans and light commercial vehicles." },
    ],
  },
  "a-line": {
    name: "A-Line",
    wheels: true,
    tagline: "Stylish mag wheels for cars, SUVs and bakkies — sold as sets of four.",
    about: [
      "A-Line mag wheels give your car, SUV or bakkie a fresh look, with designs from classic silver to bold satin-black off-road styles. Our A-Line wheels are sold as sets of four.",
      "Choose your wheel by rim size, PCD (stud pattern) and offset to make sure it fits your vehicle — or send us your vehicle details and we'll help you pick the right set.",
    ],
  },
};
