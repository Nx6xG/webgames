'use client';

import { useState } from 'react';

const NICK_PATTERN = /^[a-zA-Z0-9 _-]+$/;

interface NicknameEditorProps {
  nickname: string;
  onSave: (nickname: string) => void;
}

export function NicknameEditor({ nickname, onSave }: NicknameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(nickname);
    setError(null);
    setEditing(true);
  }

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setError('Must be 2–16 characters.');
      return;
    }
    if (!NICK_PATTERN.test(trimmed)) {
      setError('Letters, numbers, spaces, _ and - only.');
      return;
    }
    onSave(trimmed);
    setEditing(false);
    setError(null);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Nickname</p>
          <p className="text-sm text-zinc-100 font-semibold truncate">{nickname || '—'}</p>
        </div>
        <button
          onClick={startEdit}
          className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-700 bg-zinc-900 p-4 flex flex-col gap-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Nickname</p>
      <input
        autoFocus
        value={value}
        onChange={(e) => { setValue(e.target.value.slice(0, 16)); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
        maxLength={16}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
