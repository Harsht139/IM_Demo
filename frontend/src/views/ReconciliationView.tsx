import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle, CheckCircle2, Eye, ChevronRight, Sparkles,
    FileText, Loader2, ArrowUpRight, Clock
} from 'lucide-react';
import type { Conflict } from '../types';
import { cn } from '../lib/utils';
import { intelligenceApi } from '../api';
import { usePreloadDocuments } from '../hooks/usePreloadDocuments';

// Helper to format large numbers to Indian Cr/L format
function formatIndianCurrency(val: string): string {
    const clean = (val || '').replace(/,/g, '').replace(/[₹$Rs.]+/g, '').replace(/\/-\s*$/, '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return val;
    if (num >= 10000000) return `₹${(num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    return val;
}

// Helper to generate dynamic pagination range
function getPaginationRange(current: number, total: number) {
    const delta = 2; // Number of neighbors to show
    const range = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current + 1 - delta && i <= current + 1 + delta)) {
            range.push(i);
        }
    }

    const withEllipsis = [];
    let l;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                withEllipsis.push(l + 1);
            } else if (i - l !== 1) {
                withEllipsis.push('...');
            }
        }
        withEllipsis.push(i);
        l = i;
    }
    return withEllipsis;
}

export function ReconciliationView({
    buId,
    onResolve
}: {
    buId?: string,
    onResolve: (resolvedFactIds: string[]) => void
}) {
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [isLoading, setIsLoading] = useState(!!buId);
    const [error, setError] = useState<string | null>(null);
    const [choiceMap, setChoiceMap] = useState<Record<string, string>>({}); // conflict.id -> fact_id
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter unique filenames for pre-fetching
    const allFilenames = Array.from(new Set(conflicts.flatMap(c => c.sources.map(s => s.name))));
    usePreloadDocuments(buId, allFilenames);

    useEffect(() => {
        if (!buId) return;
        const loadConflicts = async () => {
            setIsLoading(true);
            try {
                const res = await intelligenceApi.getReconciliation(buId);
                const fetchedConflicts = res.conflicts || [];
                setConflicts(fetchedConflicts);

                // Pre-select recommended values
                const initialChoices: Record<string, string> = {};
                fetchedConflicts.forEach((c: Conflict) => {
                    const recommended = c.sources.find(s => s.isRecommended);
                    if (recommended?.fact_id) {
                        initialChoices[c.id] = recommended.fact_id;
                    } else if (c.sources.length > 0) {
                        initialChoices[c.id] = c.sources[0].fact_id || '';
                    }
                });
                setChoiceMap(initialChoices);
            } catch (err: any) {
                setError(err.message || "Failed to load conflicts");
            } finally {
                setIsLoading(false);
            }
        };
        loadConflicts();
    }, [buId]);

    const handleResolve = (conflictId: string, factId: string) => {
        setChoiceMap(prev => ({ ...prev, [conflictId]: factId }));

        // Auto-advance after a tiny delay for focus
        if (currentIndex < conflicts.length - 1) {
            setTimeout(() => {
                setCurrentIndex(prev => Math.min(conflicts.length - 1, prev + 1));
            }, 600);
        }
    };

    const isComplete = Object.keys(choiceMap).length === conflicts.length && conflicts.length > 0;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Reconciling source variations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Error loading facts</h3>
                <p className="text-slate-500 mb-6">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Retry</button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-12">
            {/* Header section */}
            <div className="flex items-end justify-between border-b border-slate-100 pb-8">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Reconciliation</h2>
                    <p className="text-slate-500 font-medium">
                        {conflicts.length > 0 ? (
                            <>
                                Validating <span className="font-bold text-blue-600">{currentIndex + 1} of {conflicts.length}</span> variation groups.
                            </>
                        ) : (
                            <span className="text-emerald-600 font-bold">Source data is fully aligned.</span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {isComplete ? (
                        <button
                            onClick={() => onResolve(Object.values(choiceMap))}
                            className="h-11 px-8 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 animate-bounce"
                        >
                            Confirm Truth & Proceed <ChevronRight size={18} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                Step {currentIndex + 1} / {conflicts.length}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Conflict Card with Animation */}
            <div className="min-h-[500px]">
                <AnimatePresence mode="wait">
                    {conflicts[currentIndex] ? (
                        <motion.div
                            key={conflicts[currentIndex].id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ConflictCard
                                conflict={conflicts[currentIndex]}
                                index={currentIndex}
                                selectedFactId={choiceMap[conflicts[currentIndex].id]}
                                buId={buId || ""}
                                onResolve={(factId) => handleResolve(conflicts[currentIndex].id, factId)}
                            />
                        </motion.div>
                    ) : (
                        <div className="text-center py-20 bg-emerald-50/30 rounded-[40px] border-2 border-dashed border-emerald-100">
                            <CheckCircle2 className="text-emerald-500 mx-auto mb-4" size={48} />
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Zero Conflicts Found</h3>
                            <p className="text-slate-500 font-medium mt-2">All facts are perfectly aligned across your sources.</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Pagination Controls */}
            {conflicts.length > 0 && (
                <div className="flex items-center justify-between pt-12 border-t border-slate-100">
                    <button
                        onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                        disabled={currentIndex === 0}
                        className={cn(
                            "h-12 px-8 rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
                            currentIndex === 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        Previous Metric
                    </button>

                    <div className="flex flex-nowrap items-center justify-center gap-2 max-w-[60%] overflow-x-auto py-2 scrollbar-none">
                        {getPaginationRange(currentIndex, conflicts.length).map((page, i) => (
                            page === '...' ? (
                                <span key={`dots-${i}`} className="px-1 text-slate-300 font-bold select-none">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => setCurrentIndex((page as number) - 1)}
                                    className={cn(
                                        "min-w-[32px] h-8 px-2 rounded-lg text-xs font-black transition-all duration-300 flex items-center justify-center",
                                        (page as number) - 1 === currentIndex
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110"
                                            : "bg-slate-50 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600"
                                    )}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    {isComplete && currentIndex === conflicts.length - 1 ? (
                        <button
                            onClick={() => onResolve(Object.values(choiceMap))}
                            className="h-12 px-8 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                        >
                            Finalize <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(Math.min(conflicts.length - 1, currentIndex + 1))}
                            disabled={currentIndex === conflicts.length - 1}
                            className={cn(
                                "h-12 px-8 rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
                                currentIndex === conflicts.length - 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            Next Metric <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ConflictCard({
    conflict,
    index,
    selectedFactId,
    buId,
    onResolve
}: {
    conflict: Conflict,
    index: number,
    selectedFactId?: string,
    buId: string,
    onResolve: (id: string) => void
}) {
    const periodValue = conflict.sources.find(s => s.period)?.period;

    return (
        <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Metric {index + 1}</span>
                    <div className="flex items-center gap-3">
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{conflict.metric}</h3>
                        {periodValue && (
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-200">
                                <Clock size={12} /> {periodValue}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex -space-x-3">
                    {Array.from(new Set(conflict.sources.map(s => s.name.split('.')[0]))).map((name, i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm" title={name}>
                            {name[0]}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {conflict.sources.map((source, i) => {
                    const isSelected = selectedFactId === source.fact_id;

                    return (
                        <button
                            key={i}
                            onClick={() => source.fact_id && onResolve(source.fact_id)}
                            className={cn(
                                "relative text-left p-8 rounded-[32px] border-2 transition-all duration-300 group/source flex flex-col h-full",
                                isSelected
                                    ? "border-emerald-500 bg-white shadow-xl shadow-emerald-100 ring-8 ring-emerald-500/5 translate-y-[-4px]"
                                    : "border-slate-100 bg-white hover:border-slate-300 hover:translate-y-[-4px]"
                            )}
                        >
                            {source.isRecommended && (
                                <div className="absolute -top-4 left-8 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg z-10 flex items-center gap-2">
                                    <Sparkles size={12} /> AI Recommended
                                </div>
                            )}

                            <div className="flex items-center justify-between w-full mb-8">
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-slate-50 transition-colors",
                                    isSelected ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400 group-hover/source:text-blue-500"
                                )}>
                                    <FileText size={24} />
                                </div>
                                {isSelected && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                        <CheckCircle2 size={24} className="text-emerald-500" />
                                    </motion.div>
                                )}
                            </div>

                            <div className="mb-8 space-y-2">
                                <p className={cn(
                                    "text-3xl font-black tracking-tighter leading-none",
                                    isSelected ? "text-emerald-900" : "text-slate-900"
                                )}>
                                    {formatIndianCurrency(source.value)}
                                </p>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block truncate" title={source.name}>
                                    {source.name}
                                </span>
                            </div>

                            <div
                                className="mt-auto pt-6 border-t border-slate-50 space-y-3 group/evidence cursor-pointer hover:bg-blue-50/50 -mx-2 px-2 rounded-xl transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const filename = encodeURIComponent(source.name);
                                    const page = source.page_number || 1;
                                    let queryParams = `page=${page}`;

                                    if (source.coordinates) {
                                        try {
                                            let c = source.coordinates;
                                            // Handle list format [x1, y1, x2, y2]
                                            if (Array.isArray(c) && c.length === 4) {
                                                const [x1, y1, x2, y2] = c;
                                                c = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
                                            }
                                            // Encode the object
                                            queryParams += `&coords=${encodeURIComponent(JSON.stringify(c))}`;
                                        } catch (e) {
                                            console.error("Coords encoding failed", e);
                                        }
                                    }

                                    // Add Excel context if available for pinpointing
                                    const isExcel = source.name.toLowerCase().match(/\.(xlsx|xls|csv)$/);
                                    if (isExcel && source.context && source.context.includes('!')) {
                                        queryParams += `&context=${encodeURIComponent(source.context)}`;
                                    }

                                    window.open(`/viewer/${buId}/view/${filename}#${queryParams}`, '_blank');
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <Eye size={14} />
                                        <span className="text-xs font-black uppercase tracking-widest">Evidence</span>
                                    </div>
                                    <ArrowUpRight size={14} className="text-blue-400 group-hover/evidence:text-blue-600 group-hover/evidence:translate-x-0.5 group-hover/evidence:-translate-y-0.5 transition-all" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
