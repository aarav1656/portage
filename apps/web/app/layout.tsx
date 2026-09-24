import type { Metadata } from "next";
import { Domine, IBM_Plex_Mono, Work_Sans } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const displaySerif = Domine({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-serif",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portage: bonded manifest for wtKALSHI",
  description:
    "Portage wraps Tessera pre-IPO tokens 1:1 into a plain SPL token so a Meteora DBC launch can be quoted in them for the first time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displaySerif.variable} ${workSans.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        <Nav />
        <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
