import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.livetimedata.com/" },
};

export default function HomePage() {
  return <HomeClient />;
}
