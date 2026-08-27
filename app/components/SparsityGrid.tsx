const TOTAL = 140;
// A handful of "selected" positions, with varying weight -> varying size/opacity.
// Indices chosen to scatter across the grid rather than cluster.
const SELECTED: Record<number, number> = {
  9: 0.9,
  23: 0.55,
  41: 1.0,
  58: 0.4,
  77: 0.7,
  94: 0.35,
  112: 0.6,
  126: 0.45,
};

export function SparsityGrid() {
  return (
    <div
      className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2"
      role="img"
      aria-label="Grid representing many candidate assets; a handful are highlighted, illustrating a sparse portfolio allocation"
    >
      {Array.from({ length: TOTAL }, (_, i) => {
        const weight = SELECTED[i];
        if (weight) {
          return (
            <div
              key={i}
              className="aspect-square rounded-[2px] bg-accent motion-safe:animate-[pulse_3s_ease-in-out_infinite]"
              style={{ opacity: 0.5 + weight * 0.5, animationDelay: `${(i % 7) * 0.15}s` }}
            />
          );
        }
        return <div key={i} className="aspect-square rounded-[2px] bg-border/50" />;
      })}
    </div>
  );
}
