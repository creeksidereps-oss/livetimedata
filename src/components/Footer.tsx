"use client";

import React, { useState } from "react";
import FooterModal from "./modals/FooterModal";

export default function Footer() {
  const [activeModal, setActiveModal] = useState<'about' | 'contact' | 'privacy' | 'legal' | 'terms' | null>(null);

  return (
    <footer className="border-t border-white/10 bg-black mt-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500 font-medium">
            © {new Date().getFullYear()} LiveTimeData
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <button onClick={() => setActiveModal('about')} className="text-gray-400 hover:text-white transition-colors">
              About
            </button>
            <button onClick={() => setActiveModal('contact')} className="text-gray-400 hover:text-white transition-colors">
              Contact
            </button>
            <button onClick={() => setActiveModal('privacy')} className="text-gray-400 hover:text-white transition-colors">
              Privacy
            </button>
            <button onClick={() => setActiveModal('legal')} className="text-gray-400 hover:text-white transition-colors">
              Legal
            </button>
            <button onClick={() => setActiveModal('terms')} className="text-gray-400 hover:text-white transition-colors">
              Terms
            </button>
          </nav>
        </div>
      </div>
      
      {activeModal && (
        <FooterModal type={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </footer>
  );
}