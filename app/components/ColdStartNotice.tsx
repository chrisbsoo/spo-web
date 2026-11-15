/**
 * Amber notice explaining the free-tier cold start on `spo-tools`.
 *
 * The optimisation backend runs on a Render free instance, which sleeps after
 * 15 minutes idle. The first request after a quiet spell waits for the
 * container to boot, so a click can hang for up to ~50 seconds before anything
 * comes back. Surfacing it up front is better than a spinner with no
 * explanation.
 */
export function ColdStartNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 ${className}`}
    >
      <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.15em] text-accent uppercase">
        Free-tier cold start
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-accent/90">
        The optimisation backend runs on a free instance that sleeps after 15
        minutes idle. The first request after a quiet spell can take up to{" "}
        <span className="font-[family-name:var(--font-display)] text-accent">
          ~50 seconds
        </span>{" "}
        to wake it up. Once it is warm, results come back in a second or two.
      </p>
    </div>
  );
}
