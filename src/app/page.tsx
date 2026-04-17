import { Navbar } from "@/components/landingpage/Navbar";
import { HeroSection } from "@/components/landingpage/HeroSection";
import { ProblemSolutionSection } from "@/components/landingpage/ProblemSolutionSection";
import { FeaturesSection } from "@/components/landingpage/FeaturesSection";
import { ShowcaseSection } from "@/components/landingpage/ShowcaseSection";
import { TrustSection } from "@/components/landingpage/TrustSection";
import { HowItWorksSection } from "@/components/landingpage/HowItWorksSection";
import { PricingSection } from "@/components/landingpage/PricingSection";
import { CtaSection } from "@/components/landingpage/CtaSection";
import { Footer } from "@/components/landingpage/Footer";
import RunningBoardPage from "@/components/landingpage/RunningBoardPage";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />

        <ProblemSolutionSection />
        <RunningBoardPage />
        <FeaturesSection />
        <ShowcaseSection />
        <TrustSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
