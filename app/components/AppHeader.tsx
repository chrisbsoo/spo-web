import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/spo-logo.png" alt="" width={24} height={24} />
          <span className="font-[family-name:var(--font-display)] text-sm text-foreground">SPO Web</span>
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
