import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono, Inter, Quantico } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const quantico = Quantico({
  variable: "--font-quantico",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const serif = EB_Garamond({
  variable: "--font-serif",
  weight: ["400"],
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "fetta - Text Splitting Library",
  description:
    "Text splitting library with kerning compensation for animations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="relative" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} ${quantico.variable} ${serif.variable} antialiased relative`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
