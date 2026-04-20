import { auth } from "@/lib/auth/auth";
import { Navbar, type NavbarUser } from "@/components/landingpage/Navbar";
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

interface LandingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { locale } = await params;
  const session = await auth();

  const user: NavbarUser | null = session?.user?.id
    ? {
        email: session.user.email ?? "",
        hasOrg: Boolean(session.organizationId),
      }
    : null;

  return (
    <>
      <Navbar locale={locale} user={user} />
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
