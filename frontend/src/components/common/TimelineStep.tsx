import { CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function TimelineStep({ num, label, desc, active, completed, onSelect }: { num: number, label: string, desc: string, active: boolean, completed: boolean, onSelect: () => void }) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                "w-full text-left flex gap-4 p-3 rounded-2xl transition-all duration-500 hover:bg-slate-50",
                active ? "bg-blue-50/50 ring-1 ring-blue-100" : ""
            )}
        >
            <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 z-10 transition-all duration-500 shadow-sm",
                completed ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-400"
            )}>
                {completed ? <CheckCircle size={14} /> : num}
            </div>
            <div className="flex flex-col">
                <span className={cn(
                    "text-xs font-bold leading-none mb-1",
                    completed ? "text-slate-500" : active ? "text-slate-900" : "text-slate-400"
                )}>{label}</span>
                <span className="text-[10px] text-slate-400 font-medium">{desc}</span>
            </div>
        </button>
    );
}
