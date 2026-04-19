interface UserMenuStubProps {
  userEmail: string;
}

export function UserMenuStub({ userEmail }: UserMenuStubProps) {
  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      aria-label="User menu"
      className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold hover:bg-accent transition-colors"
    >
      {initial}
    </button>
  );
}
