import { FadeIn } from "./FadeIn";

const logos = [
  { icon: "⚡", name: "ElectraCorp" },
  { icon: "🏗️", name: "BuildRight" },
  { icon: "🔧", name: "TechServe Pro" },
  { icon: "🌿", name: "GreenFields" },
  { icon: "🏥", name: "MedMobile" },
  { icon: "🚚", name: "LogiFleet" },
];

const testimonials = [
  {
    quote:
      "We cut scheduling time in half within the first week. Our dispatcher actually has time to breathe now.",
    name: "Jake Morrison",
    role: "Ops Manager, ElectraCorp",
    initials: "JM",
    color: "bg-brand-blue",
  },
  {
    quote:
      "The compliance tracking alone saved us from a six-figure fine. That's not an exaggeration.",
    name: "Sofia Reyes",
    role: "Safety Director, BuildRight",
    initials: "SR",
    color: "bg-brand-purple",
  },
  {
    quote:
      "Finally a platform built for the field, not the boardroom. My crew actually uses it.",
    name: "Kevin Dunne",
    role: "Field Supervisor, TechServe Pro",
    initials: "KD",
    color: "bg-brand-green",
  },
];

export function TrustSection() {
  return (
    <section id="trust" aria-labelledby="trust-heading" className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <p
            id="trust-heading"
            className="text-center text-slate-500 text-sm mb-10"
          >
            Trusted by field operations teams across industries
          </p>
        </FadeIn>

        {/* Logo strip */}
        <FadeIn delay={50}>
          <div
            className="flex flex-wrap justify-center gap-8 mb-16"
            aria-label="Customer logos"
          >
            {logos.map(({ icon, name }) => (
              <div
                key={name}
                className="flex items-center gap-2 text-slate-400 font-medium text-sm"
              >
                <span>{icon}</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ quote, name, role, initials, color }, i) => (
            <FadeIn key={name} delay={100 + i * 80}>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
                <div
                  className="text-yellow-400 text-base tracking-wide"
                  aria-label="5 stars"
                >
                  ★★★★★
                </div>
                <p className="text-gray-700 text-sm leading-relaxed flex-1">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${color}`}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{name}</div>
                    <div className="text-slate-500 text-xs">{role}</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
