import { redirect } from "next/navigation";

interface LocaleHomeProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleHome({ params }: LocaleHomeProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
