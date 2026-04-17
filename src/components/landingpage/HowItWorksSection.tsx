import { Fragment } from "react";
import { FadeIn } from "./FadeIn";

const steps = [
  {
    icon: "🏢",
    num: "01",
    title: "Set Up Your Org",
    desc: "Import your crew roster, define job sites, and configure roles. Takes under 10 minutes.",
  },
  {
    icon: "📅",
    num: "02",
    title: "Build Your Schedule",
    desc: "Drag crew members onto shifts. VeraCrew flags conflicts, skill gaps, and compliance risks automatically.",
  },
  {
    icon: "📊",
    num: "03",
    title: "Operate with Clarity",
    desc: "Track jobs live, respond to alerts instantly, and close out shifts with auto-generated reports.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-heading"
      className="bg-white py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
            Process
          </div>
        </FadeIn>
        <FadeIn delay={50}>
          <h2
            id="hiw-heading"
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12"
          >
            Up and running in 3 steps
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-6">
          {steps.map(({ icon, num, title, desc }, i) => (
            <Fragment key={title}>
              <FadeIn delay={100 + i * 80}>
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mb-4">
                    {icon}
                  </div>
                  <div className="text-3xl font-black text-slate-100 mb-1 select-none">
                    {num}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
              {i < steps.length - 1 && (
                <FadeIn
                  delay={140 + i * 80}
                  className="hidden md:flex items-center justify-center self-start pt-6"
                >
                  <div className="w-8 text-center text-slate-200 text-2xl select-none">
                    →
                  </div>
                </FadeIn>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
