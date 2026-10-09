import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";

// Typography (roles and weights: globals.css, "typography"). Display: DM Serif Display, which has one weight.
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

// Text: Manrope is a variable font, so every weight from 200 to 800 comes from one file.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "INNOVISION 2026 · The Celestial Odyssey · NIT Rourkela",
  description:
    "Innovision is the techno-management fest of NIT Rourkela. Four worlds, one celestial odyssey: Flagship Events, Standout Events, Main Events, and DTS and Fun Events.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
