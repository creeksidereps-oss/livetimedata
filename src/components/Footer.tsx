import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t mt-10 py-6 text-sm text-center text-gray-600">
      <div className="flex justify-center gap-6">
        <Link href="/about" className="hover:underline">About</Link>
        <Link href="/contact" className="hover:underline">Contact</Link>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </div>
    </footer>
  );
}