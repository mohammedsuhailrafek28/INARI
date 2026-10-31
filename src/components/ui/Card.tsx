import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  theme?: 'dark' | 'light' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  theme = 'dark',
  padding = 'md',
  className,
  children,
  ...props
}) => {
  const baseStyles = 'relative transition-all duration-300';

  const themeStyles = {
    dark: 'bg-canvas-card border border-border-dark text-ink-light hover:border-white/20',
    light: 'bg-canvas-lightCard border border-border-light text-ink-dark hover:border-black/20',
    bordered: 'bg-transparent border border-current text-current',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4 md:p-5',
    md: 'p-6 md:p-8',
    lg: 'p-8 md:p-12',
  };

  return (
    <div
      className={twMerge(clsx(baseStyles, themeStyles[theme], paddingStyles[padding], className))}
      {...props}
    >
      {children}
    </div>
  );
};

