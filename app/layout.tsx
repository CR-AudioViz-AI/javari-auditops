// app/layout.tsx — Javari AuditOps
// CR AudioViz AI · EIN 39-3646201 · June 2026
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Javari AuditOps | CR AudioViz AI",
  description: "Platform audit, compliance monitoring, and operational oversight for CR AudioViz AI ecosystem.",
  keywords: "platform audit, compliance monitoring, operational oversight, CR AudioViz AI, Javari AI, javariai.com",
  authors: [{ name: "CR AudioViz AI, LLC" }],
  creator: "CR AudioViz AI, LLC",
  publisher: "CR AudioViz AI, LLC",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Javari AuditOps | CR AudioViz AI",
    description: "Platform audit, compliance monitoring, and operational oversight for CR AudioViz AI ecosystem.",
    url: "https://javari-auditops.vercel.app",
    siteName: "CR AudioViz AI",
    images: [{ url: "https://craudiovizai.com/craudiovizai-logo-metallic.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Javari AuditOps | CR AudioViz AI",
    description: "Platform audit, compliance monitoring, and operational oversight for CR AudioViz AI ecosystem.",
    images: ["https://craudiovizai.com/craudiovizai-logo-metallic.png"],
    creator: "@CRAudioVizAI",
  },
  alternates: { canonical: "https://javari-auditops.vercel.app" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="https://craudiovizai.com/icon.png" type="image/png" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#040912",
        color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
