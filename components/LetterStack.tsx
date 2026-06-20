type LetterStackProps = {
  count: number;
};

export function LetterStack({ count }: LetterStackProps) {
  const layers = Math.min(Math.max(count, 2), 5);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: layers }).map((_, index) => (
        <div
          key={index}
          className="absolute inset-0 parchment-layer"
          style={{
            transform: `translate(${(index - 2) * -0.95}%, ${(index % 2) * 0.8 - 1}%) rotate(${(index - 2) * 0.8}deg)`,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}

