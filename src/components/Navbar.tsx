import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'CAPABILITIES', href: '#capabilities' },
    { label: 'WORLDS', href: '#worlds' },
    { label: 'SIMULATE', href: '#preview' },
    { label: 'ABOUT', href: '#ethics' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <>
      <header className="site-header fixed top-0 left-0 w-full z-[60] pointer-events-none mix-blend-difference text-white">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 h-20 sm:h-24 flex items-center justify-between">
          {/* Top-Left Brand Wordmark (matching the DG weight/scale in the screenshot) */}
          <a
            href="#"
            className="pointer-events-auto font-archivo font-[900] text-2xl sm:text-3xl tracking-tight uppercase text-white hover:text-[#ff3b12] transition-colors focus:outline-none"
            aria-label="INARI Home"
          >
            INARI
          </a>

          {/* Top-Right Minimal Navigation Links (matching the monospace styling in the screenshot) */}
          <div className="flex items-center gap-6 sm:gap-8 pointer-events-auto">
            <nav className="hidden md:flex items-center gap-8 lg:gap-10 font-mono text-[11px] sm:text-xs tracking-[0.14em] uppercase text-white/80">
              <a
                href="/dashboard"
                className="text-[#ff3b12] hover:text-white transition-colors font-bold flex items-center gap-1 border border-[#ff3b12]/30 px-3 py-1 rounded-full bg-[#ff3b12]/10"
              >
                <span>DASHBOARD</span>
                <span className="text-[10px]">⚡</span>
              </a>
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="hover:text-white transition-colors duration-150"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Mobile Hamburger Menu */}
            <button
              type="button"
              className="md:hidden p-2 text-white hover:text-[#ff3b12] transition-colors focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-md md:hidden flex flex-col justify-center px-8 py-16">
          <nav className="flex flex-col gap-6 font-mono text-base tracking-widest uppercase">
            <a
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#ff3b12] font-bold border-b border-[#ff3b12]/30 pb-3"
            >
              DASHBOARD ⚡
            </a>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-white/80 hover:text-[#ff3b12] border-b border-white/10 pb-3"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
};
