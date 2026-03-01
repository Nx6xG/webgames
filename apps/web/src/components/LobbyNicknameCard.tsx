'use client';

import { useState } from 'react';
import { useNickname } from '@/components/providers/NicknameProvider';
import { sanitizeNickname } from '@/lib/nickname';

export function LobbyNicknameCard() {
  const { nickname, setNickname } = useNickname();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(nickname);
    setError(null);
    setEditing(true);
  }

  function handleSave() {
    const clean = sanitizeNickname(value);
    if (clean.length < 2) {
      setError('Must be at least 2 characters.');
      return;
    }
    setNickname(clean);
    setEditing(false);
    setError(null);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0 select-none">
            {nickname.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold leading-none mb-0.5">
              Playing as
            </p>
            <p className="text-sm font-semibold text-zinc-100 truncate">{nickname || '…'}</p>
          </div>
        </div>
        <button
          onClick={startEdit}
          className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-700 bg-zinc-900 px-5 py-3 flex flex-col gap-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Your nickname</p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value.slice(0, 18)); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          maxLength={18}
          placeholder="Enter nickname…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shrink-0"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors shrink-0"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
