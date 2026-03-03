import { ExternalLink, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export function Citation({
    label,
    color,
    context = "Source data verified against internal credit models."
}: {
    label: string,
    color: 'blue' | 'indigo' | 'amber',
    context?: string
}) {
    const [isHovered, setIsHovered] = useState(false);

    const colors = {
        blue: "bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-600 hover:text-white hover:border-blue-600",
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600",
        amber: "bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-600 hover:text-white hover:border-amber-600"
    };

    return (
        <div className="relative inline-block" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <span className={cn(
                "inline-flex items-center gap-1.5 cursor-help px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border shadow-sm transition-all duration-300",
                colors[color]
            )}>
                <ExternalLink size={10} /> {label}
            </span>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-3 w-64 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 pointer-events-none"
                    >
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-50">
                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                <Eye size={12} className="text-slate-400" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Digital Annotation</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed">
                            "{context}"
                        </p>
                        <div className="absolute top-full left-6 -mt-1 w-2 h-2 bg-white border-b border-r border-slate-200 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
