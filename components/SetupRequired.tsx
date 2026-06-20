import { getMissingFirebaseKeys } from "@/lib/firebase";

export function SetupRequired() {
  const missingKeys = getMissingFirebaseKeys();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-6 py-12 text-[var(--color-text)]">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-[var(--color-border)] bg-white/76 p-8 shadow-[var(--shadow-soft)]">
        <p className="font-display text-3xl text-[var(--color-text-strong)] mb-4">Before We Begin</p>
        <p className="mb-4 leading-relaxed text-[var(--color-text-soft)]">
          Parchment needs Firebase credentials before it can keep letters safe.
          Add the missing environment values and restart the app.
        </p>
        <ul className="list-disc space-y-1 pl-6 text-[var(--color-text-soft)]">
          {missingKeys.map((key) => (
            <li key={key}>
              <code>{key}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
