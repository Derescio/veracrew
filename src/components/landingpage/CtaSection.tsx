import Link from "next/link";
import { FadeIn } from "./FadeIn";

export function CtaSection() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="bg-brand-blue py-24"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-block text-xs font-semibold text-blue-100 bg-blue-500/30 border border-blue-300/30 px-3 py-1.5 rounded-full mb-6">
              🚀 No credit card required
            </div>
            <h2
              id="cta-heading"
              className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight"
            >
              Ready to take command
              <br />
              of your field operations?
            </h2>
            <p className="text-blue-100 text-lg mb-8">
              Join 2,400+ crew managers who&apos;ve replaced the chaos with clarity.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-brand-blue font-bold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Start Free Trial — 14 Days
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 border-2 border-white/50 hover:border-white text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Book a Demo
              </Link>
            </div>
            <p className="text-blue-100/70 text-xs mt-5">
              Setup in under 10 minutes · Cancel anytime
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
