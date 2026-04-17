import { FadeIn } from "./FadeIn";

const features = [
  {
    icon: "📅",
    title: "Smart Scheduling",
    desc: "Drag-and-drop roster builder with skill matching, availability sync, and conflict detection.",
  },
  {
    icon: "📍",
    title: "Real-Time Tracking",
    desc: "Live crew check-ins, geofenced job sites, and instant ETA updates sent to dispatch.",
  },
  {
    icon: "🛡️",
    title: "Compliance Engine",
    desc: "Certification tracking, expiry alerts, and auto-generated audit trails for every shift.",
  },
  {
    icon: "💬",
    title: "Team Comms",
    desc: "In-app broadcast messages, crew-specific channels, and shift briefing templates.",
  },
  {
    icon: "💰",
    title: "Payroll Integration",
    desc: "Time tracking flows directly to payroll. Approved hours sync to your payroll provider.",
  },
  {
    icon: "📊",
    title: "Analytics & Reports",
    desc: "Coverage rates, overtime alerts, job completion trends — exportable in one click.",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-slate-50 py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
            Features
          </div>
        </FadeIn>
        <FadeIn delay={50}>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3"
          >
            Everything your crew operation needs
          </h2>
        </FadeIn>
        <FadeIn delay={100}>
          <p className="text-gray-500 text-lg mb-12 max-w-xl">
            Built for the realities of field work — not office workflows.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc }, i) => (
            <FadeIn key={title} delay={100 + i * 60}>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-brand-blue/30 hover:shadow-md transition-all group">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-2xl mb-4">
                  {icon}
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                <span className="inline-block mt-4 text-xs font-semibold text-brand-blue group-hover:underline">
                  Learn more →
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
