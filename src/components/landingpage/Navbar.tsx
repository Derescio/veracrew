"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogIn, LogOut, Plus, LayoutDashboard } from "lucide-react";

export interface NavbarUser {
  email: string;
  hasOrg: boolean;
}

interface NavbarProps {
  locale: string;
  user: NavbarUser | null;
}

export function Navbar({ locale, user }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signInHref = `/${locale}/auth/sign-in`;
  const signUpHref = `/${locale}/auth/sign-up`;
  const createOrgHref = `/${locale}/create-org`;
  const dashboardHref = `/${locale}/dashboard`;

  // Primary CTA shown on the main nav row depends on the user's state.
  const primaryCta = user
    ? user.hasOrg
      ? { href: dashboardHref, label: "Go to Dashboard", Icon: LayoutDashboard }
      : { href: createOrgHref, label: "Create Organization", Icon: Plus }
    : { href: signUpHref, label: "Get Started", Icon: null };

  const handleSignOut = () => signOut({ callbackUrl: `/${locale}` });

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-brand-navy">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center justify-end gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-slate-400 max-w-[220px] truncate">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign out
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link
              href={signInHref}
              className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Log in
              <LogIn size={18} />
            </Link>
          )}
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
          <Link href={`/${locale}`} aria-label="VeraCrew home" className="shrink-0">
            <Image
              src="/images/Logo/VeraCrewLogo_top.png"
              alt="VeraCrew"
              width={140}
              height={36}
              priority
              className="h-12 w-auto"
            />
          </Link>

          <ul
            id="nav-links"
            role="list"
            className="hidden md:flex items-center gap-8 list-none m-0 p-0"
          >
            <li>
              <a
                href="#features"
                className="text-sm text-slate-800 hover:text-brand-navy transition-colors"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                className="text-sm text-slate-800 hover:text-brand-navy transition-colors"
              >
                Pricing
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="text-sm text-slate-800 hover:text-brand-navy transition-colors"
              >
                How It Works
              </a>
            </li>
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/demo"
              className="text-sm text-slate-800 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Book Demo
            </Link>
            <Link
              href={primaryCta.href}
              className={`inline-flex items-center gap-2 text-sm font-semibold bg-brand-navy hover:bg-brand-blue-dark text-white px-4 py-2 rounded-lg transition-colors ${isScrolled ? "text-white" : "text-slate-300"}`}
            >
              {primaryCta.Icon ? <primaryCta.Icon size={16} /> : null}
              {primaryCta.label}
            </Link>
          </div>

          <button
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-md text-slate-300 hover:text-white focus:outline-none"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>

        {menuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden bg-brand-navy border-t border-brand-navy-border px-6 py-4 flex flex-col gap-4"
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
            <div className="flex flex-col gap-2 pt-2 border-t border-brand-navy-border">
              <Link
                href="/demo"
                className="text-center text-sm text-slate-300 hover:text-white border border-brand-navy-border px-4 py-2 rounded-lg"
                onClick={() => setMenuOpen(false)}
              >
                Book Demo
              </Link>
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center gap-2 text-center text-sm font-semibold bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2 rounded-lg"
                onClick={() => setMenuOpen(false)}
              >
                {primaryCta.Icon ? <primaryCta.Icon size={16} /> : null}
                {primaryCta.label}
              </Link>
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleSignOut();
                  }}
                  className="text-center text-sm text-slate-300 hover:text-white border border-brand-navy-border px-4 py-2 rounded-lg"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
