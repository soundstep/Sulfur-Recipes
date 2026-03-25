import React from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function CyberButton({ children, variant = 'primary', size = 'md', className, ...props }: CyberButtonProps) {
  const base = "relative border-2 uppercase font-display tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black";
  
  const variants = {
    primary: "border-primary text-primary hover:bg-primary hover:text-black hover:shadow-[0_0_15px_rgba(57,255,20,0.4)]",
    secondary: "border-chain text-chain hover:bg-chain hover:text-black hover:shadow-[0_0_15px_rgba(0,255,255,0.4)]",
    danger: "border-partial text-partial hover:bg-partial hover:text-black hover:shadow-[0_0_15px_rgba(255,170,0,0.4)]",
    ghost: "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5",
  };
  
  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-xl font-bold",
  };

  return (
    <button 
      className={twMerge(clsx(base, variants[variant], sizes[size]), className)}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {/* Glitch/shimmer overlay effect on hover */}
      <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-shimmer" />
    </button>
  );
}
