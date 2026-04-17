# Current Feature

**Status:** In Progress — `feat/landing-page`

---

## Goals

Convert the `prototypes/veracrew-homepage/index.html` prototype into the production Next.js App Router landing page at `/`. The page must:

- Be built from individual server/client components in `src/components/landingpage/`
- Use Tailwind v4 CSS utilities (no inline styles, no CSS Modules)
- Use `"use client"` only for interactive components (Navbar hamburger, Pricing toggle, ShowcaseStats counter, FadeIn scroll observer)
- Be structured to support future auth CTAs (Get Started → `/auth/register`, Book Demo → `/demo`)
- Keep all external inputs (auth state, org data) gated server-side

---

## Plan

### Sections (from prototype)
1. **Navbar** — sticky, hamburger mobile menu, scroll-shadow effect (client)
2. **HeroSection** — headline, bullets, trust strip, app window mockup, floating notification (server)
3. **ProblemSolutionSection** — Without / With VeraCrew cards (server)
4. **FeaturesSection** — 6 feature cards grid (server)
5. **ShowcaseSection** — stats counter + dashboard map + notification bar (server shell + client stats)
6. **TrustSection** — logo strip + 3 testimonials (server)
7. **HowItWorksSection** — 3 steps (server)
8. **PricingSection** — monthly/yearly toggle + 3 plan cards (client)
9. **CtaSection** — final CTA (server)
10. **Footer** — brand + nav cols + social links (server)

### Files
```
src/components/landingpage/
  FadeIn.tsx              (client - IntersectionObserver scroll fade wrapper)
  Navbar.tsx              (client - sticky nav + hamburger)
  HeroSection.tsx         (server)
  ProblemSolutionSection.tsx (server)
  FeaturesSection.tsx     (server)
  ShowcaseStats.tsx       (client - number counter animation)
  ShowcaseSection.tsx     (server)
  TrustSection.tsx        (server)
  HowItWorksSection.tsx   (server)
  PricingSection.tsx      (client - billing toggle state)
  CtaSection.tsx          (server)
  Footer.tsx              (server)

src/app/page.tsx          (server - assembles sections)
src/app/globals.css       (add brand tokens + fade-in keyframes)
```

---

## Notes

- No shadcn/ui installed — use raw Tailwind v4 classes
- Brand colors: primary blue `#3b82f6`, green `#22c55e`, dark navy `#0b1120`
- Auth CTAs use `href="/auth/register"` and `href="/demo"` as placeholders
- App window in Hero is decorative HTML only (aria-hidden)

---

## History

- 2026-04-15: Completed `marketing-homepage` — replaced placeholder page.tsx with full marketing homepage (Nav, Hero, Features, AI, Pricing, CTA, Footer) using Tailwind v4 + shadcn/ui, blue brand color, physics chaos icons, pricing toggle, scroll fade-in, and mobile hamburger.
- 2026-04-16: Completed `homepage-mockup` — standalone HTML/CSS/JS prototype in `prototypes/veracrew-homepage/` with 8 sections (Nav, Hero, Problem→Solution, Features Grid, Product Showcase, Trust, How It Works, Pricing, CTA, Footer), sticky nav, pricing toggle, counter animations, scroll fade-in; committed directly to main.
- 2026-04-16: Started `feat/landing-page` — converting prototype to production Next.js landing page.
