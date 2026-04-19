interface OrgSwitcherStubProps {
  orgName: string;
}

export function OrgSwitcherStub({ orgName }: OrgSwitcherStubProps) {
  const initial = orgName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
      <span className="flex size-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
        {initial}
      </span>
      <span className="max-w-32 truncate font-medium">{orgName}</span>
    </div>
  );
}
