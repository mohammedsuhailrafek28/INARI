import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'vermilion' | 'emerald' | 'gold' | 'neutral' | 'outline';
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dot = false,
  className,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wideMono uppercase border select-none';

  const variantStyles = {
    vermilion: 'bg-thread/10 text-thread border-thread/30',
    emerald: 'bg-emerald/10 text-emerald border-emerald/30',
    gold: 'bg-gold/10 text-gold-light border-gold/30',
    neutral: 'bg-white/5 text-ink-mutedLight border-white/10',
    outline: 'bg-transparent text-current border-current',
  };

  const dotColors = {
    vermilion: 'bg-thread',
    emerald: 'bg-emerald',
    gold: 'bg-gold-light',
    neutral: 'bg-white/60',
    outline: 'bg-current',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variantStyles[variant], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  );
};

