"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";


export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-brand-navy ">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center justify-end">

          <Link
            href="/auth/login"
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors"
          >

            Log in
            <User size={20} />
          </Link>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className={`fixed top-8 left-0 right-0 z-40 transition-all duration-300 ${isScrolled
          ? "bg-white/90 backdrop-blur-md shadow-lg shadow-black/20"
          : "bg-white"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between mt-1">
          {/* Logo */}
          <Link href="/" aria-label="VeraCrew home" className="flex-shrink-0">
            <Image
              src="/images/Logo/VeraCrewLogo_top.png"
              alt="VeraCrew"
              width={140}
              height={36}
              priority
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop nav links */}
          <ul
            id="nav-links"
            role="list"
            className="hidden md:flex items-center gap-8 list-none m-0 p-0"
          >
            <li>
              <a
                href="#features"
                className={`text-sm text-slate-800 hover:text-brand-navy transition-colors `}
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                className={`text-sm text-slate-800 hover:text-brand-navy transition-colors `}
              >
                Pricing
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className={`text-sm text-slate-800 hover:text-brand-navy transition-colors `}
              >
                How It Works
              </a>
            </li>
          </ul>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/demo"
              className={`text-sm text-slate-800 hover:text-white px-4 py-2 rounded-lg transition-colors `}
            >
              Book Demo
            </Link>
            <Link
              href="/auth/register"
              className={`text-sm font-semibold bg-brand-navy hover:bg-brand-blue-dark text-white px-4 py-2 rounded-lg transition-colors ${isScrolled ? "text-white" : "text-slate-300"}`}
            >
              Get Started
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-md text-slate-300 hover:text-white focus:outline-none"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden bg-[#0b1120] border-t border-[#1e2d45] px-6 py-4 flex flex-col gap-4"
          >
            <a
              href="#features"
              className="text-slate-300 hover:text-white text-sm py-1"
              onClick={() => setMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-slate-300 hover:text-white text-sm py-1"
              onClick={() => setMenuOpen(false)}
            >
              Pricing
            </a>
            <a
              href="#how-it-works"
              className="text-slate-300 hover:text-white text-sm py-1"
              onClick={() => setMenuOpen(false)}
            >
              How It Works
            </a>
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1e2d45]">
              <Link
                href="/demo"
                className="text-center text-sm text-slate-300 hover:text-white border border-[#1e2d45] px-4 py-2 rounded-lg"
                onClick={() => setMenuOpen(false)}
              >
                Book Demo
              </Link>
              <Link
                href="/auth/register"
                className="text-center text-sm font-semibold bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2 rounded-lg"
                onClick={() => setMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
