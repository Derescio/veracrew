import Image from "next/image";
import Link from "next/link";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Product Tour", href: "#showcase" },
  { label: "Changelog", href: "#" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Security", href: "#" },
];

export function Footer() {
  return (
    <footer id="footer" aria-label="Site footer" className="bg-[#0b1120]">
      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-12">
        {/* Brand */}
        <div className="flex-1 min-w-0 max-w-xs">
          <Link href="/" aria-label="VeraCrew home" className="inline-block mb-4">
            <Image
              src="/images/Logo/VeraCrewLogo.png"
              alt="VeraCrew"
              width={130}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <p className="text-slate-400 text-sm leading-relaxed mb-5">
            Field operations software built for the people running the show on
            the ground.
          </p>
          <div className="flex items-center gap-4" aria-label="Social media">
            <a
              href="#"
              aria-label="Twitter/X"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="LinkedIn"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Nav columns */}
        <nav
          className="flex flex-wrap gap-12"
          aria-label="Footer navigation"
        >
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
              {productLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
              {companyLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
            <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
              {legalLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className="border-t border-[#1e2d45]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-500">
          <span>© 2026 VeraCrew. All rights reserved.</span>
          <span className='text-lg'>Powered by <Link href='https://www.opsedsolutions.com' target='_blank' className="text-brand-blue hover:text-brand-blue-dark transition-colors">opsedsolutions.com</Link>.</span>
        </div>
      </div>
    </footer>
  );
}
