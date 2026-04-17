# Current Feature: VeraCrew Homepage Mockup

**Status:** In Progress

---

## Goals

Build a high-converting SaaS marketing homepage **prototype** (standalone HTML/CSS/JS) for VeraCrew — a field operations platform — covering 8 sections: Nav, Hero, Problem→Solution, Features Grid, Product Showcase, Trust, How It Works, Pricing, Final CTA, and Footer. Output lives in `prototypes/veracrew-homepage/` and is **not** part of the Next.js app.

---

## Plan

### Architecture

- **Database changes:** None
- **Server actions:** None
- **UI:** Pure HTML/CSS/JS prototype — no framework
- **Utilities:** Vanilla JS for scroll-based animations, pricing toggle, counter increment, sticky nav

---

### Files to Create or Modify

| File | Action | Why |
|---|---|---|
| `prototypes/veracrew-homepage/index.html` | Create | Main markup for all 8 sections + nav + footer |
| `prototypes/veracrew-homepage/styles.css` | Create | All layout, typography, colors, animations, responsive breakpoints |
| `prototypes/veracrew-homepage/script.js` | Create | Sticky nav scroll, pricing toggle, counter animation, scroll fade-in |

---

### Implementation Steps

- [x] 1. Create `prototypes/veracrew-homepage/` directory
- [x] 2. Build `index.html` — Sticky Nav with logo, links, CTAs
- [x] 3. Hero section — two-column layout, headline, subheadline, bullets, CTAs, social proof, mock dashboard visual (CSS art / SVG)
- [x] 4. Problem→Solution section — two columns with descriptive text and mock UI cards (CSS)
- [x] 5. Features Grid — 6 cards with icon (SVG/emoji), title, description, hover effect
- [x] 6. Product Showcase — large centered mock dashboard with animated stat counters and notification popups
- [x] 7. Trust section — placeholder logo strip + tagline
- [x] 8. How It Works — 3-step horizontal layout with icons and connecting line
- [x] 9. Pricing section — Starter / Pro (highlighted) cards + monthly/yearly toggle
- [x] 10. Final CTA section — gradient background, headline, two CTA buttons
- [x] 11. Footer — logo, nav links, social icons, copyright
- [x] 12. `styles.css` — full palette (`#1e3a8a`, `#22c55e`, `#f8fafc`, `#0f172a`), typography scale, card styles, responsive (mobile-first), animations
- [x] 13. `script.js` — sticky nav transparency→solid on scroll, pricing toggle, counter increment on viewport enter, scroll fade-in via IntersectionObserver
- [ ] 14. Verify renders correctly in browser, test mobile viewport

---

### Edge Cases

- No external image URLs (use CSS gradients, SVG placeholders, or emoji for visuals to keep prototype self-contained)
- Pricing toggle must update displayed prices without page reload
- Counter animation should only fire once per page load when element enters viewport
- Nav must remain accessible (keyboard-navigable) even while transparent
- Responsive breakpoint at 768px: single-column layout, full-width buttons

---

### Key Patterns

**Sticky Nav JS:**
`script.js`: `window.addEventListener('scroll', ...)` → toggle class `scrolled` on `<nav>` (adds `background:#1e3a8a` + `box-shadow`)

**Counter Animation:**
`script.js`: `IntersectionObserver` on `.stat-number[data-target]` → `requestAnimationFrame` increment loop

**Pricing Toggle:**
`script.js`: Toggle `data-billing="monthly"|"yearly"` on `<section id="pricing">` → CSS `[data-billing="yearly"] .price-monthly { display:none }` swap

**Scroll Fade-in:**
`script.js`: `IntersectionObserver` on `.fade-in` → add class `visible` → CSS `opacity:0 → 1`, `translateY(20px → 0)`

**Color variables (styles.css):**
```
:root {
  --color-primary: #1e3a8a;
  --color-accent: #22c55e;
  --color-bg: #f8fafc;
  --color-text: #0f172a;
  --color-warn: #f59e0b;
  --color-issue: #ef4444;
}
```

---

## Notes

- This is a **standalone prototype** — output goes to `prototypes/veracrew-homepage/`, NOT inside `src/app/`
- No Tailwind, no React, no Next.js — pure HTML/CSS/JS
- Images: use CSS gradient backgrounds and SVG-based UI mockups; no external fetch dependencies
- Branch: `feature/homepage-mockup`

---

## History

- 2026-04-15: Completed `marketing-homepage` — replaced placeholder page.tsx with full marketing homepage (Nav, Hero, Features, AI, Pricing, CTA, Footer) using Tailwind v4 + shadcn/ui, blue brand color, physics chaos icons, pricing toggle, scroll fade-in, and mobile hamburger.
