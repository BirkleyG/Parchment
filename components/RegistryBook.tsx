"use client";

import { motion } from "framer-motion";

type RegistryBookProps = {
  currentPage: number;
  totalPages: number;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onJumpToLetter?: (letter: string) => void;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function RegistryBook({
  currentPage,
  totalPages,
  leftContent,
  rightContent,
  onPrev,
  onNext,
  onJumpToLetter,
}: RegistryBookProps) {
  return (
    <div className="absolute left-[21.8%] right-[8.7%] top-[10.7%] bottom-[8.6%] z-30">
      <div className="relative w-full h-full">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28 }}
          className="absolute left-[8.9%] right-[8.7%] top-[10.2%] bottom-[10.8%] grid grid-cols-2 gap-[5%] text-[#2f241a]"
        >
          <div className="pr-[5%]">{leftContent}</div>
          <div className="pl-[5%]">{rightContent}</div>
        </motion.div>

        <div className="absolute left-[9.2%] right-[9.2%] bottom-[4.4%] flex items-center justify-between text-[#4d3322]">
          <button type="button" onClick={onPrev} className="text-[0.95vw] text-[#5f432d] hover:text-[#8c643f]">
            Previous Page
          </button>
          <span className="text-[0.9vw] tracking-[0.11em] uppercase text-[#6e4d35]">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button type="button" onClick={onNext} className="text-[0.95vw] text-[#5f432d] hover:text-[#8c643f]">
            Next Page
          </button>
        </div>

        {onJumpToLetter ? (
          <div className="absolute right-[0.2%] top-[8.8%] bottom-[11.2%] w-[3.9%] grid grid-rows-[repeat(26,minmax(0,1fr))]">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => onJumpToLetter(letter)}
                className="rounded-sm hover:bg-[#8a5a2d]/16"
              >
                <span className="sr-only">Jump to {letter}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

