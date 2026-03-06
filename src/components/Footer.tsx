// src/components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} LiveTimeData
          </div>

          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link className="text-gray-700 hover:text-black" href="/about">
              About
            </Link>
            <Link className="text-gray-700 hover:text-black" href="/contact">
              Contact
            </Link>
            <Link className="text-gray-700 hover:text-black" href="/privacy">
              Privacy
            </Link>
            <Link className="text-gray-700 hover:text-black" href="/terms">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}