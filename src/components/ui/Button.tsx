import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'vermilion' | 'outline' | 'chalk' | 'ghost' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'vermilion',
  size = 'md',
  className,
  children,
  icon,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-mono font-medium tracking-wideMono uppercase transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-thread focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2 gap-2 border',
    md: 'text-xs md:text-sm px-5 py-3 gap-2.5 border',
    lg: 'text-sm md:text-base px-7 py-4 gap-3 border',
  };

  const variantStyles = {
    vermilion: 'bg-thread border-thread text-white hover:bg-[#e0340f] hover:shadow-[0_0_20px_rgba(255,59,18,0.4)]',
    outline: 'bg-transparent border-current text-current hover:bg-white/10 hover:border-white',
    chalk: 'bg-canvas-light text-ink-dark border-canvas-light hover:bg-white hover:shadow-lg',
    dark: 'bg-canvas-dark text-ink-light border-border-dark hover:bg-canvas-card hover:border-white/30',
    ghost: 'bg-transparent border-transparent text-current hover:bg-white/5',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      {...props}
    >
      {children}
      {icon && <span className="inline-flex transition-transform group-hover:translate-x-0.5">{icon}</span>}
    </button>
  );
};

