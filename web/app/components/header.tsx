'use client';

import { TrainFront, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  view: string | null;
  onBack: () => void;
}

export default function Header({ view, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border-primary/60 bg-bg-elevated/80 backdrop-blur-xl" style={{ isolation: 'isolate' }}>
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        {view ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <TrainFront size={17} className="text-white" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-text-primary">M2HRail</span>
              <span className="hidden sm:inline text-xs text-text-tertiary font-mono">rail.m2hio.in</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
