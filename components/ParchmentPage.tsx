"use client";

import Image from "next/image";

type ParchmentPageProps = {
  text: string;
  onTextChange: (value: string) => void;
  onOverflowAttempt?: () => void;
  imageTransform?: string;
  shellClassName?: string;
  textClassName?: string;
};

export function ParchmentPage({
  text,
  onTextChange,
  onOverflowAttempt,
  imageTransform,
  shellClassName,
  textClassName,
}: ParchmentPageProps) {
  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    const previousValue = text;
    const isGrowing = nextValue.length > previousValue.length;

    if (isGrowing && event.currentTarget.scrollHeight > event.currentTarget.clientHeight + 1) {
      onOverflowAttempt?.();
      return;
    }

    onTextChange(nextValue);
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      <div className={`relative w-[86%] h-[96%] rotate-[-1.55deg] drop-shadow-[0_16px_26px_rgba(0,0,0,0.42)] ${shellClassName ?? ""}`}>
        <div
          className="absolute inset-0"
          style={{
            transform: imageTransform,
            transformOrigin: "center center",
          }}
        >
          <Image
            src="/assets/references/parchment-sheet.png"
            alt="Parchment"
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 90vw"
          />
        </div>

        <textarea
          aria-label="Letter body"
          value={text}
          onChange={handleChange}
          placeholder=""
          className={`absolute left-[9.4%] top-[7.2%] w-[81.2%] h-[84.2%] resize-none overflow-hidden bg-transparent focus:outline-none text-[0.18vw] leading-[1.34] font-typewriter font-semibold tracking-[0.03em] text-[#1f1813] ${textClassName ?? ""}`}
        />
      </div>
    </div>
  );
}
