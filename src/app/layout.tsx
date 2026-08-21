import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./styles.css";
import "./design-refresh.css";

const defaultDescription =
  "OfferLab helps UK graduate applicants organise applications, tailor truthful CVs and cover letters, and prepare with evidence for each recruitment stage.";

export const metadata: Metadata = {
  applicationName: "OfferLab",
  description: defaultDescription,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === "production" ? "https://offerlab.uk" : "http://127.0.0.1:3000"),
  ),
  openGraph: {
    description: defaultDescription,
    images: [
      {
        alt: "OfferLab — Build the proof behind every application",
        height: 909,
        url: "/og.png",
        width: 1731,
      },
    ],
    locale: "en_GB",
    siteName: "OfferLab",
    title: "OfferLab",
    type: "website",
  },
  title: "OfferLab",
  twitter: {
    card: "summary_large_image",
    description: defaultDescription,
    images: ["/og.png"],
    title: "OfferLab",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
