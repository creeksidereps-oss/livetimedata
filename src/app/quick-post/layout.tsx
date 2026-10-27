import type { Metadata } from "next";

// Utility / internal page: keep out of Google's index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
