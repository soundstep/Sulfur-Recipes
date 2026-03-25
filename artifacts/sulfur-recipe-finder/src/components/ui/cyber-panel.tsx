import React from "react";
import clsx from "clsx";

interface CyberPanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
  action?: React.ReactNode;
}

export function CyberPanel({ title, children, className, fullHeight = false, action }: CyberPanelProps) {
  return (
    <div className={clsx("border border-border bg-black/40 flex flex-col relative", fullHeight && "h-full", className)}>
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary -translate-x-[1px] -translate-y-[1px]" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary translate-x-[1px] -translate-y-[1px]" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary -translate-x-[1px] translate-y-[1px]" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary translate-x-[1px] translate-y-[1px]" />

      {/* Header */}
      <div className="bg-border/30 px-4 py-2 border-b border-border flex justify-between items-center">
        <h2 className="font-display font-bold tracking-widest text-lg text-foreground/90 uppercase">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      
      {/* Content */}
      <div className={clsx("p-4", fullHeight && "flex-1 flex flex-col min-h-0")}>
        {children}
      </div>
    </div>
  );
}
