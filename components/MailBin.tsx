type MailBinProps = {
  name: string;
  letters: number;
  unopened: number;
  selected?: boolean;
  onSelect?: () => void;
};

export function MailBin({ name, letters, unopened, selected, onSelect }: MailBinProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-[8%] rounded-sm transition ${
        selected ? "bg-[#8a6337]/18" : "hover:bg-[#8a6337]/12"
      }`}
    >
      <p className="font-display text-[1.35vw] text-[#e8cb9c]">{name}</p>
      <p className="text-[0.98vw] text-[#cfb084] mt-[3.2%]">
        {letters} letters • {unopened} unopened
      </p>
    </button>
  );
}
