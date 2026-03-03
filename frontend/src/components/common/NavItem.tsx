import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function NavItem({
    icon,
    label,
    active = false,
    onClick
}: {
    icon: ReactNode,
    label: string,
    active?: boolean,
    onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300",
                active
                    ? "bg-white text-slate-900 font-bold shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
            )}
        >
            <div className="flex items-center gap-3">
                <span className={cn("transition-colors", active ? "text-blue-600" : "text-slate-400")}>{icon}</span>
                <span className="text-sm">{label}</span>
            </div>
            {active && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
        </button>
    );
}
