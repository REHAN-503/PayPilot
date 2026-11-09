import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";

export const metadata: Metadata = {
  title: "PayPilot — Flight Desk",
  description: "A permissioned purchase desk for planning, proving, asking, and paying.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="day">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
