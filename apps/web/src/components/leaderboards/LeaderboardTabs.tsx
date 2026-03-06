'use client';

interface Tab {
  id: string;
  label: string;
  emoji?: string;
}

interface Props {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function LeaderboardTabs({ tabs, activeId, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            activeId === tab.id
              ? 'bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {tab.emoji && <span>{tab.emoji}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
