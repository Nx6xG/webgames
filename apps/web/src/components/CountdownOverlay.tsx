interface Props {
  countdown: string | null;
}

export function CountdownOverlay({ countdown }: Props) {
  if (!countdown) return null;

  const isGo = countdown === 'Go!';

  return (
    <div className="cd-overlay absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm">
      <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-6 select-none">
        Match found
      </p>
      <div
        key={countdown}
        className={`cd-number font-black select-none leading-none ${
          isGo
            ? 'text-emerald-400 text-6xl'
            : 'text-white text-[7rem]'
        }`}
      >
        {countdown}
      </div>
    </div>
  );
}
