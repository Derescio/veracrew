import { FadeIn } from "./FadeIn";

const problems = [
  {
    icon: "📱",
    title: "Scattered communication",
    desc: "Shift changes lost in group chats. Managers juggling 5 apps.",
  },
  {
    icon: "📄",
    title: "Compliance nightmares",
    desc: "Expired certifications discovered at audits — not before.",
  },
  {
    icon: "🔍",
    title: "Zero visibility",
    desc: 'No real-time location data. "Where\'s your team?" is always a guess.',
  },
];

const solutions = [
  {
    icon: "🗂️",
    title: "One command center",
    desc: "Scheduling, comms, and job tracking in a single dashboard.",
  },
  {
    icon: "🛡️",
    title: "Auto compliance tracking",
    desc: "Cert expiry alerts 30 days out. Audit logs always ready.",
  },
  {
    icon: "📍",
    title: "Live crew visibility",
    desc: "Real-time check-ins, job status, and ETA — no guesswork.",
  },
];

export function ProblemSolutionSection() {
  return (
    <section
      id="problem-solution"
      aria-labelledby="ps-heading"
      className="bg-white py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
            The Problem
          </div>
        </FadeIn>
        <FadeIn delay={50}>
          <h2
            id="ps-heading"
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12 max-w-2xl leading-tight"
          >
            Field ops shouldn&apos;t feel like herding cats over WhatsApp
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-start">
          {/* Problems */}
          <FadeIn delay={100}>
            <div>
              <h3 className="text-base font-bold text-gray-500 mb-4">
                Without VeraCrew
              </h3>
              <div className="flex flex-col gap-3">
                {problems.map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4"
                  >
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm mb-0.5">
                        {title}
                      </p>
                      <p className="text-gray-500 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Arrow divider */}
          <FadeIn
            delay={150}
            className="hidden md:flex items-center justify-center self-stretch"
          >
            <div className="flex flex-col items-center gap-2 text-slate-300 select-none">
              <div className="w-px flex-1 bg-slate-200" />
              <span className="text-2xl">→</span>
              <div className="w-px flex-1 bg-slate-200" />
            </div>
          </FadeIn>

          {/* Solutions */}
          <FadeIn delay={200}>
            <div>
              <h3 className="text-base font-bold text-brand-blue mb-4">
                With VeraCrew
              </h3>
              <div className="flex flex-col gap-3">
                {solutions.map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-4"
                  >
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm mb-0.5">
                        {title}
                      </p>
                      <p className="text-gray-500 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
