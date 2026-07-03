'use client';

type Props = {
  instruction?: string | null;
};

export function FieldInstructionHint({ instruction }: Props) {
  if (!instruction?.trim()) return null;

  return (
    <span className="relative inline-flex align-middle ml-1 group/hint">
      <span
        className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold leading-none flex items-center justify-center cursor-help select-none ring-1 ring-amber-200"
        aria-label={instruction}
      >
        !
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-30 hidden group-hover/hint:block w-52 max-w-[min(16rem,70vw)] p-2 text-[10px] leading-snug bg-slate-900 text-white rounded-lg shadow-lg"
      >
        {instruction}
      </span>
    </span>
  );
}
