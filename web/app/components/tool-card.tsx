'use client';

import { LucideIcon } from 'lucide-react';

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}

export default function ToolCard({ title, description, icon: Icon, onClick }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-xl bg-bg-elevated p-5 text-left transition-all duration-200"
      style={{ boxShadow: 'var(--shadow-card)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h3>
        <p className="mt-0.5 text-xs text-text-tertiary leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
