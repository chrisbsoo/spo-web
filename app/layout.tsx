import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

// Deliberately not next/font/google here: this repo needs to build in
// environments without access to Google Fonts' CDN (e.g. sandboxed CI).
// System font stacks in globals.css cover this; swapping to self-hosted
// fonts via next/font/local is a safe upgrade once that constraint doesn't
// apply to your deployment environment.

export const metadata: Metadata = {
  title: "SPO Web: sparse portfolio optimisation for traders",
  description: "Build a sparse, long-only portfolio allocation from real market data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#ffb000",
          colorBackground: "#12181f",
          colorForeground: "#e8edf2",
          colorMutedForeground: "#7c8894",
          colorNeutral: "#7c8894",
          colorDanger: "#e5484d",
          colorSuccess: "#3dd68c",
          colorInput: "#171e26",
          colorBorder: "#232b35",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
