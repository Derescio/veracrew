import Link from "next/link";
import { FadeIn } from "./FadeIn";

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-headline"
      className="relative bg-[#0b1120] pt-32 pb-20 overflow-hidden"
    >
      {/* Background blobs */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-1/4 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12">
        {/* Left: Copy */}
        <FadeIn className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Trusted by 500+ field teams
          </div>

          <h1
            id="hero-headline"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5"
          >
            Run Your Crew
            <br />
            <span className="text-brand-blue">With Confidence</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-lg mb-8 leading-relaxed">
            Manage teams, track hours, collect documents, and stay compliant —
            all in one place.
          </p>

          <div className="flex flex-wrap gap-4 mb-8">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Get Started
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Book Demo
            </Link>
          </div>

          <ul className="flex flex-col gap-2.5 mb-8 list-none p-0 m-0" aria-label="Key benefits">
            {[
              "Clock in with GPS restrictions",
              "Manage team compliance docs",
              "Keep track of all job sites",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="10" fill="#22c55e" />
                  <path
                    d="M6 10l3 3 5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <div className="border-t border-[#1e2d45] pt-6">
            <p className="text-xs text-slate-500 mb-3">
              Trusted by teams in construction, healthcare, and field operations
            </p>
            <div className="flex flex-wrap items-center gap-4" aria-label="Trusted companies">
              {["Apex", "Grove", "Shield", "ClearPath", "Fixit"].map((name) => (
                <span key={name} className="text-xs text-slate-500 font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Right: App window mockup */}
        <FadeIn className="flex-1 min-w-0 w-full max-w-xl" delay={150}>
          <div
            aria-hidden="true"
            className="rounded-xl overflow-hidden border border-[#1e2d45] shadow-2xl shadow-black/40 bg-[#111827]"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-3 bg-[#0d1526] px-4 py-2.5 border-b border-[#1e2d45]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="flex-1 text-center text-xs text-slate-500">
                app.veracrew.com
              </span>
            </div>

            {/* App layout */}
            <div className="flex h-72 text-xs">
              {/* Sidebar */}
              <aside className="w-36 bg-[#0d1526] border-r border-[#1e2d45] p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L4 7v5c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V7L12 2z"
                      fill="url(#heroGrad)"
                    />
                    <defs>
                      <linearGradient id="heroGrad" x1="4" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#22c55e" />
                        <stop offset="1" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="text-white font-semibold text-xs">veracrew</span>
                </div>
                {[
                  { label: "Dashboard", active: true },
                  { label: "Crew", active: false },
                  { label: "Locations", active: false },
                  { label: "Time", active: false },
                  { label: "Payroll", active: false },
                ].map(({ label, active }) => (
                  <div
                    key={label}
                    className={`px-2 py-1.5 rounded-md text-xs ${
                      active
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-slate-500"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </aside>

              {/* Main content */}
              <div className="flex-1 p-3 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-xs">
                    Welcome back, <span className="text-white font-semibold">David!</span>
                  </span>
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">
                    DM
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: "Active Crew", value: "24", color: "text-green-400" },
                    { label: "On Site", value: "18", color: "text-blue-400" },
                    { label: "Missing Docs", value: "5", color: "text-amber-400" },
                    { label: "Hours", value: "126h", color: "text-slate-300" },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-[#0d1526] rounded-lg p-2 border border-[#1e2d45]"
                    >
                      <div className="text-slate-500 text-[10px]">{label}</div>
                      <div className={`font-bold text-sm ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Table */}
                <div className="bg-[#0d1526] rounded-lg border border-[#1e2d45] overflow-hidden">
                  <div className="px-2.5 py-1.5 border-b border-[#1e2d45] text-slate-400 text-[10px] font-medium">
                    Live Crew Status
                  </div>
                  {[
                    { name: "John Doe", loc: "Eastside", status: "Active", color: "bg-green-400" },
                    { name: "Sarah M.", loc: "Downtown", status: "Break", color: "bg-blue-400" },
                    { name: "Mike T.", loc: "Warehouse", status: "Docs", color: "bg-amber-400" },
                  ].map(({ name, loc, status, color }) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-2.5 py-1 border-b border-[#1e2d45] last:border-0"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
                      <span className="text-slate-300 flex-1 text-[10px]">{name}</span>
                      <span className="text-slate-500 text-[10px]">{loc}</span>
                      <span className="text-[10px] text-blue-400 font-medium">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating notification */}
          <div className="absolute -bottom-4 -left-4 bg-[#111827] border border-[#1e2d45] rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl text-xs hidden lg:flex">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-white font-semibold">Payroll sync complete</div>
              <div className="text-slate-400">142 hours submitted</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
