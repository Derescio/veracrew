import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// The next-intl middleware normally handles the root redirect, but this
// file exists as a safety net in case middleware is skipped for any reason.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
