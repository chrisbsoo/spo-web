"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this portfolio? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/portfolios/${portfolioId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-muted hover:text-danger transition-colors disabled:opacity-40"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
