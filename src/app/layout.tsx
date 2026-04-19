import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VeraCrew — Run Your Crew With Confidence",
  description:
    "Manage teams, track hours, collect documents, and stay compliant — all in one place. Field operations software for crews who mean business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
