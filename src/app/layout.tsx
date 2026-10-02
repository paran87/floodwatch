import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Body: Inter. Display (headings, big numbers): Barlow Condensed. Labels/eyebrows: IBM Plex Mono.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "FloodWatch",
  description: "Monitoring, mapping, and reporting flood-prone areas in the Philippines.",
};

// viewport-fit=cover lets phones with an edge-to-edge system bar report their safe-area inset to the bottom nav.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2a6b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlowCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
