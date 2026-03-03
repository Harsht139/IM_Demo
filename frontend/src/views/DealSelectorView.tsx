import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, ChevronRight, Database, Clock, Flame, Wind, Sun, Route, Building2, Trash2, Pencil, Check, X } from 'lucide-react';
import type { Deal } from '../types';
import { cn } from '../lib/utils';

const DEAL_TYPE_ICONS: Record<string, React.ReactNode> = {
    'Solar PV': <Sun size={20} />,
    'Wind': <Wind size={20} />,
    'Thermal': <Flame size={20} />,
    'Road': <Route size={20} />,
    'Infrastructure': <Building2 size={20} />,
    'Real Estate': <Building2 size={20} />,
    'Other': <Zap size={20} />,
};

const STATUS_COLOR: Record<string, string> = {
    'DRAFT': 'bg-slate-100 text-slate-500',
    'READY_FOR_REVIEW': 'bg-amber-50 text-amber-600',
    'COMMITTEE_REVIEW': 'bg-blue-50 text-blue-600',
    'APPROVED': 'bg-emerald-50 text-emerald-600',
};

interface DealSelectorViewProps {
    projectName: string;
    deals: Deal[];
    onSelectDeal: (deal: Deal) => void;
    onCreateDeal: () => void;
    onDeleteDealIM: (dealId: string) => void;
    onRenameProject: (newName: string) => Promise<void>;
    onRenameDeal: (dealId: string, newName: string) => Promise<void>;
}

export function DealSelectorView({ projectName, deals, onSelectDeal, onCreateDeal, onDeleteDealIM, onRenameProject, onRenameDeal }: DealSelectorViewProps) {
    // Project Rename State
    const [isRenamingProject, setIsRenamingProject] = useState(false);
    const [projectRenameValue, setProjectRenameValue] = useState(projectName);
    const [isSavingProject, setIsSavingProject] = useState(false);
    const projectInputRef = useRef<HTMLInputElement>(null);

    // Deal Rename State
    const [renamingDealId, setRenamingDealId] = useState<string | null>(null);
    const [dealRenameValue, setDealRenameValue] = useState("");
    const [isSavingDeal, setIsSavingDeal] = useState(false);
    const dealInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setProjectRenameValue(projectName); }, [projectName]);
    useEffect(() => { if (isRenamingProject) projectInputRef.current?.focus(); }, [isRenamingProject]);
    useEffect(() => { if (renamingDealId) dealInputRef.current?.focus(); }, [renamingDealId]);

    const commitProjectRename = async () => {
        const trimmed = projectRenameValue.trim();
        if (!trimmed || trimmed === projectName) { setIsRenamingProject(false); return; }
        setIsSavingProject(true);
        await onRenameProject(trimmed);
        setIsSavingProject(false);
        setIsRenamingProject(false);
    };

    const startDealRename = (deal: Deal, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingDealId(deal.id);
        setDealRenameValue(deal.name);
    };

    const commitDealRename = async (dealId: string) => {
        const trimmed = dealRenameValue.trim();
        if (!trimmed) { setRenamingDealId(null); return; }
        setIsSavingDeal(true);
        await onRenameDeal(dealId, trimmed);
        setIsSavingDeal(false);
        setRenamingDealId(null);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    {/* Project name — click to rename (Uppercase removed) */}
                    {isRenamingProject ? (
                        <div className="flex items-center gap-2 mb-1">
                            <input
                                ref={projectInputRef}
                                value={projectRenameValue}
                                onChange={e => setProjectRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commitProjectRename(); if (e.key === 'Escape') { setIsRenamingProject(false); setProjectRenameValue(projectName); } }}
                                className="text-[10px] font-black text-blue-600 tracking-widest bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-300 w-48"
                            />
                            <button onClick={commitProjectRename} disabled={isSavingProject} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <Check size={13} />
                            </button>
                            <button onClick={() => { setIsRenamingProject(false); setProjectRenameValue(projectName); }} className="p-0.5 rounded text-slate-400 hover:bg-slate-100 transition-colors">
                                <X size={13} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsRenamingProject(true)}
                            className="group flex items-center gap-2 mb-1 hover:bg-blue-50 rounded-lg px-1.5 py-0.5 -ml-1.5 transition-colors"
                            title="Click to rename project"
                        >
                            <p className="text-[10px] font-black text-blue-600 tracking-widest">{projectName}</p>
                            <Pencil size={12} className="text-blue-300 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                        </button>
                    )}
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Deal Pipeline</h2>
                    <p className="text-slate-500 font-medium mt-1.5">Select an active deal or initialize a new one to start synthesis.</p>
                </div>
                <button
                    onClick={onCreateDeal}
                    className="h-12 px-6 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus size={18} /> New Deal
                </button>
            </div>

            {/* Deal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <AnimatePresence>
                    {deals.map((deal, i) => (
                        <motion.div
                            key={deal.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => onSelectDeal(deal)}
                            className="bg-white rounded-[36px] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 cursor-pointer group transition-all p-7 relative overflow-hidden"
                        >
                            {/* Type Icon */}
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform",
                                "bg-blue-50 text-blue-600"
                            )}>
                                {DEAL_TYPE_ICONS[deal.deal_type] || <Zap size={20} />}
                            </div>

                            <div className="flex items-start justify-between mb-1 min-h-[32px]">
                                {renamingDealId === deal.id ? (
                                    <div className="flex items-center gap-2 w-full pr-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            ref={dealInputRef}
                                            value={dealRenameValue}
                                            onChange={e => setDealRenameValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') commitDealRename(deal.id); if (e.key === 'Escape') setRenamingDealId(null); }}
                                            className="text-lg font-black text-slate-900 leading-snug bg-slate-50 border border-blue-200 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-300 w-full"
                                        />
                                        <button onClick={() => commitDealRename(deal.id)} disabled={isSavingDeal} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
                                        <button onClick={() => setRenamingDealId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group/title w-full">
                                        <h3 className="text-lg font-black text-slate-900 leading-snug truncate">{deal.name}</h3>
                                        <button
                                            onClick={(e) => startDealRename(deal, e)}
                                            className="opacity-0 group-hover/title:opacity-100 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-all"
                                            title="Rename deal"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-4">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", STATUS_COLOR[deal.status] || STATUS_COLOR['DRAFT'])}>
                                    {deal.status.replace('_', ' ')}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                    {deal.deal_type}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-400 mb-5">
                                <div><span className="text-slate-300">Sector</span><br />{deal.sector}</div>
                                <div><span className="text-slate-300">Capacity</span><br />{deal.capacity || '—'}</div>
                                <div><span className="text-slate-300">Counterparty</span><br />{deal.counterparty || '—'}</div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-300">Docs</span>
                                    <span className="flex items-center gap-1"><Database size={10} />{deal.files.length}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                    <Clock size={11} />
                                    {new Date(deal.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2">
                                    {deal.im_sections.length > 0 ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteDealIM(deal.id); }}
                                            title="Delete Information Memorandum"
                                            className="flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 px-2 py-1 rounded-full transition-colors"
                                        >
                                            <Trash2 size={9} /> Delete IM
                                        </button>
                                    ) : null}
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>

                            {/* BG Glow */}
                            <div className="absolute -top-8 -right-8 w-24 h-24 bg-blue-50 rounded-full blur-2xl opacity-0 group-hover:opacity-80 transition-all" />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Create New Deal Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: deals.length * 0.05 }}
                    onClick={onCreateDeal}
                    className="bg-white rounded-[36px] border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 cursor-pointer group transition-all p-7 flex flex-col items-center justify-center text-center min-h-[240px] gap-4"
                >
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-blue-50 text-slate-300 group-hover:text-blue-500 flex items-center justify-center transition-all">
                        <Plus size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-600 group-hover:text-slate-900 transition-colors">New Deal</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">Initialize a new deal workspace</p>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
