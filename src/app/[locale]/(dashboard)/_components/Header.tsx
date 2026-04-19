import type { OrgContext } from "@/lib/auth/types";
import { OrgSwitcherStub } from "./OrgSwitcherStub";
import { UserMenuStub } from "./UserMenuStub";

interface HeaderProps {
  ctx: OrgContext;
}

export function Header({ ctx }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div />
      <div className="flex items-center gap-3">
        <OrgSwitcherStub orgName={ctx.orgName} />
        <UserMenuStub userEmail={ctx.userEmail} />
      </div>
    </header>
  );
}
