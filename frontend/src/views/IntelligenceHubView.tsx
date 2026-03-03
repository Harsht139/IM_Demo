import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, ChevronRight, Layout, Zap, ClipboardList, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { intelligenceApi } from '../api';

interface ProductCardProps {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    active?: boolean;
    isGenerating?: boolean;
    buttonText?: string;
    onClick?: () => void;
}

function ProductCard({ title, description, icon, active, isGenerating, buttonText, onClick }: ProductCardProps) {
    return (
        <div
            onClick={(active && !isGenerating) ? onClick : undefined}
            className={cn(
                "p-8 rounded-[40px] border-2 transition-all relative overflow-hidden group",
                active
                    ? isGenerating ? "bg-white border-blue-200 cursor-wait shadow-xl shadow-blue-100/50 opacity-80" : "bg-white border-slate-100 hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-200/40 cursor-pointer"
                    : "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
            )}
        >
            <div className={cn(
                "w-16 h-16 rounded-3xl flex items-center justify-center mb-6 transition-all",
                active ? "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" : "bg-slate-100 text-slate-400"
            )}>
                {icon}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
            <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">{description}</p>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100/50">
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    active ? "text-blue-600" : "text-slate-400"
                )}>
                    {active ? (isGenerating ? "Synthesizing..." : (buttonText || "Generate Now")) : "Coming Soon"}
                </span>
                {active && !isGenerating && <ChevronRight size={18} className="text-blue-600 transition-transform group-hover:translate-x-1" />}
                {isGenerating && <Loader2 size={18} className="text-blue-600 animate-spin" />}
            </div>

            {/* Premium Glow */}
            {active && !isGenerating && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full -mr-16 -mt-16 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            {/* Loading Overlay */}
            {isGenerating && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] rounded-[40px]" />
            )}
        </div>
    );
}

export function IntelligenceHubView({ buId, onAction, isGenerating }: { buId?: string, onAction: (action: string) => void, isGenerating?: boolean }) {
    const [hasExistingIM, setHasExistingIM] = useState(false);
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (!buId || hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        intelligenceApi.getExistingIM(buId)
            .then(() => setHasExistingIM(true))
            .catch(() => { });
    }, [buId]);

    const products = [
        { id: 'im', title: 'Information Memorandum', description: 'Comprehensive debt financing synthesis with high-fidelity reconciliation.', icon: <FileText size={32} />, active: true, isGenerating, buttonText: hasExistingIM ? 'View Latest' : 'Generate Now', onClick: () => onAction('im') },
        { id: 'proposal', title: 'Deal Proposal', description: 'Executive summary and key commercial terms for internal review.', icon: <Layout size={32} /> },
        { id: 'teaser', title: 'Market Teaser', description: 'Anonymized high-level profile for external outreach.', icon: <Zap size={32} /> },
        { id: 'term_sheet', title: 'Term Sheet Eval', description: 'Automated extraction and benchmarking of term sheet clauses.', icon: <ClipboardList size={32} /> },
        { id: 'projections', title: 'Comparison Report', description: 'Side-by-side benchmarking against historical unit performances.', icon: <TrendingUp size={32} /> },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-blue-600" />
                    <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">Nexus Generator</p>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">What do you want to build?</h2>
                <p className="text-slate-500 font-medium mt-2">Select a financial artifact to synthesize from your workspace intelligence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map((p) => (
                    <ProductCard key={p.id} {...p} />
                ))}
            </div>
        </motion.div>
    );
}
