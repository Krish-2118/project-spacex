import type { Metadata, Viewport } from "next";
import { Cinzel, Space_Grotesk } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  weight: ["700", "900"],
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "INNOVISION 2026 · The Celestial Odyssey · NIT Rourkela",
  description:
    "Innovision is the techno-management fest of NIT Rourkela. Three worlds, one celestial odyssey: Flagship Events, Main Events, and DTS and Fun Events.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cinzel.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
