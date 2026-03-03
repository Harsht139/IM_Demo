import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Send, ExternalLink, Quote } from 'lucide-react';

interface Source {
    number: number;
    source_id: string;
    title: string;
    url: string;
    page_number?: number;
    snippet: string;
}

interface ResearchViewProps {
    onQuery?: (query: string) => Promise<{ answer: string; sources: Source[] }>;
}

export function ResearchView({ onQuery }: ResearchViewProps) {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ answer: string; sources: Source[] } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !onQuery) return;

        setIsLoading(true);
        try {
            const data = await onQuery(query);
            setResult(data);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const renderAnswerWithCitations = (text: string) => {
        // Regex to find [n] and replace with interactive superscripts
        const parts = text.split(/(\[\d+\])/g);
        return parts.map((part, i) => {
            const match = part.match(/\[(\d+)\]/);
            if (match) {
                const num = parseInt(match[1]);
                return (
                    <sup
                        key={i}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black cursor-pointer hover:bg-blue-600 hover:text-white transition-all mx-0.5"
                        onClick={() => {
                            const el = document.getElementById(`source-${num}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el?.classList.add('ring-4', 'ring-blue-100', 'bg-blue-50/50');
                            setTimeout(() => el?.classList.remove('ring-4', 'ring-blue-100', 'bg-blue-50/50'), 2000);
                        }}
                    >
                        {num}
                    </sup>
                );
            }
            return part;
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-12">
            <div className="space-y-4 text-center">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Intelligence Ledger</h2>
                <p className="text-slate-500 font-medium">Cross-reference deal artifacts and verify factual claims with auditable citations.</p>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Search size={22} />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask about EBITDA, covenants, or deal structure..."
                    className="w-full h-20 pl-16 pr-32 rounded-[32px] bg-white border-2 border-slate-100 focus:border-blue-600 outline-none text-xl font-medium placeholder:text-slate-300 shadow-xl shadow-slate-200/50 transition-all focus:shadow-2xl focus:shadow-blue-200/20"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-4 top-4 bottom-4 px-8 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2 group/btn active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? "Analyzing..." : "Analyze"} <Send size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                </button>
            </form>

            <AnimatePresence mode="wait">
                {result && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-12"
                    >
                        {/* Answer Section */}
                        <div className="bg-white border border-slate-200/60 rounded-[40px] p-10 shadow-2xl shadow-slate-100/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-50 pointer-events-none">
                                <Quote size={120} />
                            </div>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Factual Synthesis</span>
                            </div>
                            <div className="prose prose-slate max-w-none text-slate-700 text-lg font-medium leading-relaxed">
                                {renderAnswerWithCitations(result.answer)}
                            </div>
                        </div>

                        {/* Reference Section */}
                        <div className="space-y-8" ref={scrollRef}>
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-slate-100" />
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Source Reconciler [{result.sources.length}]</h3>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {result.sources.map((source) => (
                                    <div
                                        key={source.number}
                                        id={`source-${source.number}`}
                                        className="group bg-slate-50 border border-slate-100 rounded-3xl p-6 transition-all duration-500 hover:bg-white hover:shadow-xl hover:border-blue-100 scroll-mt-24"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-blue-600 font-black text-sm shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {source.number}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{source.title}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page {source.page_number || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <a href={source.url} target="_blank" rel="noreferrer" className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                        <div className="pl-11 pr-2 relative">
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 rounded-full" />
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed italic group-hover:text-slate-600 transition-colors">
                                                "{source.snippet}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
