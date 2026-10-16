import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { CompareProvider } from "@/lib/compare";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { FloatingWidgets } from "@/components/FloatingWidgets";
import { ScrollToTop } from "@/components/ScrollToTop";
import { themeCss } from "@/lib/theme";

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
    "Buy tyres, mag wheels and 4x4 rubber online in South Africa. Free nationwide delivery on 2 or more tyres. Buy now, pay later with HappyPay.",
  metadataBase: new URL("https://thetyremall.co.za"),
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeVars = await themeCss();
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ttm-theme')==='light')document.documentElement.dataset.theme='light';}catch(e){}`,
          }}
        />
        {themeVars && <style id="ttm-theme" dangerouslySetInnerHTML={{ __html: themeVars }} />}
      </head>
      <body>
        <CartProvider>
          <CompareProvider>
            <ScrollToTop />
            <Header />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <FloatingWidgets />
          </CompareProvider>
        </CartProvider>
      </body>
    </html>
  );
}
