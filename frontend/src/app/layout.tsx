import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Barlow_Condensed } from "next/font/google";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";
import { ConvexClientProvider } from "./ConvexClientProvider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-broadcast-next",
});

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = "KickOff 3D";
const SITE_DESCRIPTION =
  "A 3D browser soccer game built with Three.js and Rapier physics.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("h-full antialiased", "font-sans", geist.variable, barlowCondensed.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          <I18nProvider>
            <LocaleSyncEffect />
            {children}
            <Toaster position="bottom-right" />
          </I18nProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
