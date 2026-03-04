interface Props {
  show: boolean;
  label: string;
}

export function WaitingForConnectionOverlay({ show, label }: Props) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-indigo-400 rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm font-medium select-none">{label}</p>
      </div>
    </div>
  );
}
