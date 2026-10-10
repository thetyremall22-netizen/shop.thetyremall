import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { Tyrone } from "@/components/Tyrone";
import { ScrollToTop } from "@/components/ScrollToTop";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "The Tyre Mall — SA's Largest Online Tyre Supplier",
    template: "%s · The Tyre Mall",
  },
  description:
    "Buy tyres, mag wheels and 4x4 rubber online in South Africa. Free nationwide delivery on 2 or more tyres. Buy now, pay later with HappyPay & Mobicred.",
  metadataBase: new URL("https://thetyremall.co.za"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body>
        <CartProvider>
          <ScrollToTop />
          <Header />
          <main>{children}</main>
          <Footer />
          <CartDrawer />
          <Tyrone />
        </CartProvider>
      </body>
    </html>
  );
}
