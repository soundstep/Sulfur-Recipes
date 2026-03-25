import { Link } from "wouter";
import { CyberButton } from "@/components/ui/cyber-button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground selection:bg-primary selection:text-black font-sans">
      <div className="text-center border-2 border-partial p-8 bg-black/80 shadow-[0_0_30px_rgba(255,170,0,0.15)] relative max-w-md w-full mx-4">
        {/* Corner decors */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-partial -translate-x-[2px] -translate-y-[2px]" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-partial translate-x-[2px] -translate-y-[2px]" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-partial -translate-x-[2px] translate-y-[2px]" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-partial translate-x-[2px] translate-y-[2px]" />

        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black px-4">
          <AlertTriangle size={56} className="text-partial animate-pulse" />
        </div>
        
        <h1 className="text-8xl font-display font-bold text-partial mt-6 mb-2 tracking-widest">404</h1>
        <p className="text-lg font-sans text-muted-foreground uppercase tracking-widest mb-8 border-t border-b border-partial/30 py-3">
          System offline<br/>Directory not found
        </p>
        
        <Link href="/">
          <CyberButton variant="danger" className="w-full">Return to Base</CyberButton>
        </Link>
      </div>
    </div>
  );
}
