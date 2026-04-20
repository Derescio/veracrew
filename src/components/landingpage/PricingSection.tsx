"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    monthlyPrice: "$49",
    yearlyPrice: "$39",
    desc: "Perfect for small crews under 25 people.",
    features: [
      "Up to 25 crew members",
      "Scheduling & availability",
      "Basic compliance tracking",
      "Job tracking dashboard",
      "Email support",
    ],
    cta: "Get Started",
    href: "/en/auth/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: "$149",
    yearlyPrice: "$119",
    desc: "For growing teams that need full control.",
    badge: "Most Popular",
    features: [
      "Unlimited crew members",
      "Advanced scheduling + AI suggestions",
      "Full compliance engine + audit logs",
      "Real-time tracking & geofencing",
      "Payroll integration",
      "Priority support + onboarding call",
    ],
    cta: "Start Free Trial",
    href: "/en/auth/sign-up",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    desc: "Multi-site orgs with complex compliance needs.",
    features: [
      "Everything in Pro",
      "Multi-org / franchise support",
      "SSO & custom roles",
      "Dedicated account manager",
      "SLA & white-glove onboarding",
    ],
    cta: "Contact Sales",
    href: "/contact",
    highlighted: false,
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-slate-50 py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
          Pricing
        </div>
        <h2
          id="pricing-heading"
          className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6"
        >
          Simple, transparent pricing
        </h2>

        {/* Billing toggle */}
        <div
          className="flex items-center gap-3 mb-12"
          role="group"
          aria-label="Billing cycle"
        >
          <span
            className={`text-sm font-medium ${!isYearly ? "text-gray-900" : "text-gray-400"}`}
          >
            Monthly
          </span>
          <button
            role="switch"
            aria-checked={isYearly}
            onClick={() => setIsYearly((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
              isYearly ? "bg-brand-blue" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isYearly ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${isYearly ? "text-gray-900" : "text-gray-400"}`}
          >
            Yearly{" "}
            <span className="ml-1 text-xs font-semibold text-brand-green bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
              Save 20%
            </span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(
            ({ name, monthlyPrice, yearlyPrice, desc, badge, features, cta, href, highlighted }) => {
              const price = isYearly ? yearlyPrice : monthlyPrice;
              const isCustom = price === "Custom";

              return (
                <div
                  key={name}
                  className={`relative flex flex-col rounded-2xl p-6 border transition-shadow ${
                    highlighted
                      ? "bg-[#0b1120] border-brand-blue shadow-lg shadow-blue-500/20"
                      : "bg-white border-slate-200"
                  }`}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-brand-blue px-3 py-1 rounded-full">
                      {badge}
                    </div>
                  )}

                  <div
                    className={`text-base font-bold mb-3 ${highlighted ? "text-white" : "text-gray-900"}`}
                  >
                    {name}
                  </div>

                  <div className="mb-2">
                    <span
                      className={`text-4xl font-black ${highlighted ? "text-white" : "text-gray-900"}`}
                    >
                      {price}
                    </span>
                    {!isCustom && (
                      <span className={`text-sm ml-1 ${highlighted ? "text-slate-400" : "text-gray-500"}`}>
                        /mo
                      </span>
                    )}
                  </div>

                  <p className={`text-sm mb-5 ${highlighted ? "text-slate-400" : "text-gray-500"}`}>
                    {desc}
                  </p>

                  <ul className="flex flex-col gap-2.5 mb-6 flex-1 list-none p-0 m-0">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-brand-green text-sm leading-none mt-0.5">✓</span>
                        <span
                          className={`text-sm ${highlighted ? "text-slate-300" : "text-gray-600"}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={href}
                    className={`text-center text-sm font-semibold py-3 rounded-xl transition-colors ${
                      highlighted
                        ? "bg-brand-blue hover:bg-brand-blue-dark text-white"
                        : "border border-slate-300 hover:border-brand-blue text-gray-700 hover:text-brand-blue"
                    }`}
                  >
                    {cta}
                  </Link>
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}
