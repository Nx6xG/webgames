'use client';

import type { Cell } from 'shared';

interface Props {
  board: Cell[];
  winnerCells?: number[];
  disabled: boolean;
  onCellClick: (index: number) => void;
}

export function TicTacToeBoard({ board, winnerCells = [], disabled, onCellClick }: Props) {
  const winSet = new Set<number>(winnerCells);

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
      {board.map((cell, idx) => {
        const isWinner = winSet.has(idx);
        const isEmpty = cell === null;
        const clickable = isEmpty && !disabled;

        return (
          <button
            key={idx}
            onClick={() => clickable && onCellClick(idx)}
            disabled={!clickable}
            aria-label={cell ?? `cell ${idx}`}
            className={[
              'aspect-square rounded-xl text-4xl font-black flex items-center justify-center border-2 transition-all duration-150 select-none',
              isWinner
                ? 'bg-yellow-900/50 border-yellow-500 scale-105'
                : 'bg-zinc-900 border-zinc-700',
              cell === 'X' ? 'text-indigo-400' : cell === 'O' ? 'text-rose-400' : 'text-transparent',
              clickable
                ? 'hover:border-indigo-500 hover:bg-indigo-950/50 cursor-pointer'
                : 'cursor-default',
            ].join(' ')}
          >
            {cell ?? '·'}
          </button>
        );
      })}
    </div>
  );
}
