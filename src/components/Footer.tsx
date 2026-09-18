import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black mt-6 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500 font-medium">
            © {new Date().getFullYear()} LiveTimeData
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold">
            <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
            <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/legal" className="text-gray-400 hover:text-white transition-colors">
              Legal
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}