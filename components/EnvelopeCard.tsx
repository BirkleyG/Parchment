import type { CSSProperties } from "react";

import type { Letter } from "@/lib/types";

type EnvelopeCardProps = {
  letter: Letter;
  stacked?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function EnvelopeCard({
  letter,
  stacked = false,
  className = "",
  style,
}: EnvelopeCardProps) {
  return (
    <div
      className={`relative rounded-sm border border-[#96704b]/35 shadow-[0_14px_28px_rgba(0,0,0,0.42)] overflow-hidden ${className}`}
      style={{
        ...style,
        background:
          "linear-gradient(180deg, rgba(220,190,145,0.98) 0%, rgba(199,167,126,0.97) 100%)",
      }}
    >
      <div className="absolute inset-0 opacity-18 pointer-events-none mix-blend-multiply bg-[url('/assets/overlays/envelope-front.png')] bg-cover bg-center" />
      <div className="absolute top-[15%] left-[12%] text-[#2d2118]">
        <p className="font-fountain text-[2.2vw] leading-[1.1]">{letter.toName || "Awaiting Name"}</p>
        <p className="font-fountain text-[1.75vw] leading-[1.15]">
          @{letter.toMailboxName || "awaiting-address"}
        </p>
      </div>
      <div className="absolute top-[14%] right-[8%] w-[13%] h-[24%] border border-[#7d6146]/40 bg-[#bea57e]/70 text-center flex items-center justify-center text-[0.76vw] tracking-[0.12em] text-[#4f3927]">
        POST
      </div>
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[12.2%] aspect-square rounded-full bg-[radial-gradient(circle_at_30%_30%,_#87411e,_#58210f)] border border-[#55200d]/75 shadow-[0_4px_12px_rgba(0,0,0,0.42)]" />
      {!stacked ? (
        <div className="absolute bottom-[8%] right-[7%] text-[0.88vw] tracking-[0.05em] text-[#4f3927]">
          This letter is still sealed.
        </div>
      ) : null}
    </div>
  );
}
