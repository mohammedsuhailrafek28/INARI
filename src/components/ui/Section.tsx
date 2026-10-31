import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  canvas?: 'dark' | 'light';
  container?: boolean;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  canvas = 'dark',
  container = true,
  className,
  children,
  ...props
}) => {
  const canvasStyles = {
    dark: 'bg-canvas-dark text-ink-light',
    light: 'bg-canvas-light text-ink-dark',
  };

  return (
    <section
      className={twMerge(clsx('relative w-full py-16 md:py-24 lg:py-32 overflow-hidden', canvasStyles[canvas], className))}
      {...props}
    >
      {container ? (
        <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
};

