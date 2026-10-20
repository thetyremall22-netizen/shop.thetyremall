import type { Metadata } from "next";
import { menuBrands } from "@/lib/brand-registry";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { CompareProvider } from "@/lib/compare";
import { AccountProvider } from "@/lib/account-client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { FloatingWidgets } from "@/components/FloatingWidgets";
import { AttributionTracker } from "@/components/AttributionTracker";
import { ScrollToTop } from "@/components/ScrollToTop";
import { GoogleTracking, GoogleTagManagerNoScript } from "@/components/GoogleTracking";
import { CookieConsent } from "@/components/CookieConsent";
import { themeCss } from "@/lib/theme";
import { SEARCH_CONSOLE_VERIFICATION } from "@/lib/analytics";

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
  verification: { google: SEARCH_CONSOLE_VERIFICATION },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeVars = await themeCss();
  const brands = await menuBrands(); // live brand list for the "Shop by Brands" menu
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ttm-theme')==='light')document.documentElement.dataset.theme='light';}catch(e){}`,
          }}
        />
        {themeVars && <style id="ttm-theme" dangerouslySetInnerHTML={{ __html: themeVars }} />}
        <GoogleTracking />
      </head>
      <body>
        <GoogleTagManagerNoScript />
        <CartProvider>
          <CompareProvider>
          <AccountProvider>
            <ScrollToTop />
            <Header brands={brands} />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <FloatingWidgets />
            <AttributionTracker />
            <CookieConsent />
          </AccountProvider>
          </CompareProvider>
        </CartProvider>
      </body>
    </html>
  );
}
