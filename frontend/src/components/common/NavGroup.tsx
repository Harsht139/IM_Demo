import type { ReactNode } from 'react';

export function NavGroup({ label, children, className }: { label: string, children: ReactNode, className?: string }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-3">{label}</p>
            {children}
        </div>
    );
}
