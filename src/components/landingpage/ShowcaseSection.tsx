import { FadeIn } from "./FadeIn";
import { ShowcaseStats } from "./ShowcaseStats";

const notifications = [
  {
    text: (
      <>
        🟢 <strong>Team Alpha</strong> checked in at Site A · 10:04 AM
      </>
    ),
  },
  {
    text: (
      <>
        ⚠️ <strong>K. Davis</strong> cert expires in 14 days — action needed
      </>
    ),
  },
  {
    text: (
      <>
        ✅ <strong>Payroll sync</strong> complete · 142 hours submitted
      </>
    ),
  },
];

export function ShowcaseSection() {
  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      className="bg-[#0b1120] py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
            Product
          </div>
        </FadeIn>
        <FadeIn delay={50}>
          <h2
            id="showcase-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-10 max-w-2xl leading-tight"
          >
            See what command over your field ops actually looks like
          </h2>
        </FadeIn>

        {/* Stats counters */}
        <FadeIn delay={100}>
          <ShowcaseStats />
        </FadeIn>

        {/* Dashboard mockup */}
        <FadeIn delay={150} className="mt-10">
          <div
            aria-hidden="true"
            className="rounded-2xl overflow-hidden border border-[#1e2d45] bg-[#111827] shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2d45]">
              <span className="text-white font-semibold text-sm">
                Live Operations View
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 border border-[#1e2d45] px-3 py-1 rounded-md">
                  Export
                </span>
                <span className="text-xs text-white bg-brand-blue px-3 py-1 rounded-md font-medium">
                  + Add Job
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col md:flex-row gap-0">
              {/* Map */}
              <div className="flex-1 min-h-48 relative bg-[#0d1526] border-r border-[#1e2d45]">
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-20">
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern
                        id="grid"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="0.5"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>
                {/* Map pins */}
                {[
                  { top: "30%", left: "25%", label: "Site A" },
                  { top: "55%", left: "60%", label: "Site B" },
                  { top: "20%", left: "70%", label: "Site C" },
                ].map(({ top, left, label }) => (
                  <div
                    key={label}
                    className="absolute flex items-center gap-1"
                    style={{ top, left }}
                  >
                    <div className="relative w-3 h-3">
                      <div className="absolute inset-0 rounded-full bg-brand-blue animate-ping opacity-60" />
                      <div className="relative w-3 h-3 rounded-full bg-brand-blue" />
                    </div>
                    <span className="text-[10px] text-white bg-[#0d1526] border border-[#1e2d45] px-1.5 py-0.5 rounded">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Panel */}
              <div className="w-full md:w-64 p-4 flex flex-col gap-5">
                {/* Today's Jobs */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Today&apos;s Jobs
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        color: "bg-brand-green",
                        text: "Electrical Inspection — Bldg 4",
                        status: "Done",
                        statusColor: "text-brand-green",
                      },
                      {
                        color: "bg-brand-blue",
                        text: "HVAC Maintenance — Tower B",
                        status: "Active",
                        statusColor: "text-brand-blue",
                      },
                      {
                        color: "bg-amber-400",
                        text: "Safety Audit — Warehouse 2",
                        status: "2:00 PM",
                        statusColor: "text-amber-400",
                      },
                    ].map(({ color, text, status, statusColor }) => (
                      <div key={text} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                        <span className="text-slate-300 text-xs flex-1 truncate">{text}</span>
                        <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Crew Status */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Crew Status
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { initials: "JM", color: "bg-brand-blue", name: "J. Martinez", status: "On-site · Site A" },
                      { initials: "SR", color: "bg-brand-purple", name: "S. Rodriguez", status: "En route · ETA 12 min" },
                    ].map(({ initials, color, name, status }) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${color}`}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="text-white text-xs font-medium">{name}</div>
                          <div className="text-slate-500 text-[10px]">{status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification bar */}
            <div className="border-t border-[#1e2d45] px-5 py-3 flex flex-wrap gap-4 bg-[#0d1526]">
              {notifications.map((n, i) => (
                <div key={i} className="text-xs text-slate-400">
                  {n.text}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
