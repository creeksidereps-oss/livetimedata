// src/app/page.tsx
import { redirect } from "next/navigation";

// IMPORTANT: prevent prerendering "/" during build
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  redirect("/city-dashboard");
}