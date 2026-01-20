import { source } from "@/app/source";
import { Analytics } from "@vercel/analytics/next";
import { GithubInfo } from "fumadocs-ui/components/github-info";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono, Inter, Quantico } from "next/font/google";
import { FettaLogo } from "./components/icons/fetta-logo";
import { SidebarSeparator } from "./components/sidebar-separator";
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
  weight: ["400", "500"],
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Fetta",
    template: "Fetta | %s",
  },
  description:
    "Text splitting library with kerning compensation for animations",
  openGraph: {
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.png"],
  },
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
        <RootProvider>
          <DocsLayout
            tree={source.pageTree}
            nav={{
              title: (
                <span className="h-5 block pl-px">
                  <FettaLogo />
                </span>
              ),
              url: "/",
            }}
            sidebar={{
              components: {
                Separator: SidebarSeparator,
              },
            }}
            links={[
              {
                type: "custom",
                children: (
                  <GithubInfo
                    owner="dimicx"
                    repo="fetta"
                    className="lg:-mx-2"
                  />
                ),
              },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
