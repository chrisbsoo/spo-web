import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-[family-name:var(--font-display)] text-sm text-foreground">
          spo-web
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
