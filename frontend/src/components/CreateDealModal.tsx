import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import type { DealCreate } from '../types';

const DEAL_TYPES = ['Solar PV', 'Wind', 'Thermal', 'Road', 'Infrastructure', 'Real Estate', 'Other'];
const SECTORS = ['Renewables', 'Infrastructure', 'Power', 'Transportation', 'Real Estate', 'Manufacturing', 'Other'];

interface CreateDealModalProps {
    isOpen: boolean;
    projectName: string;
    onClose: () => void;
    onCreate: (deal: DealCreate) => Promise<void>;
}

export function CreateDealModal({ isOpen, projectName, onClose, onCreate }: CreateDealModalProps) {
    const [form, setForm] = useState<DealCreate>({
        name: '',
        deal_type: 'Solar PV',
        sector: 'Renewables',
        capacity: '',
        counterparty: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (key: keyof DealCreate, val: string) => setForm((prev: DealCreate) => ({ ...prev, [key]: val }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setIsSubmitting(true);
        try {
            await onCreate(form);
            setForm({ name: '', deal_type: 'Solar PV', sector: 'Renewables', capacity: '', counterparty: '' });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-[32px] shadow-[0_32px_96px_-16px_rgba(15,23,42,0.2)] border border-slate-100 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative p-8 pb-6">
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-50/60 via-white to-white -z-10" />
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                        <Zap className="text-white w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">New Deal</h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">in {projectName}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Deal Name */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Deal Name *</label>
                                    <input
                                        autoFocus required
                                        value={form.name}
                                        onChange={e => set('name', e.target.value)}
                                        placeholder="e.g. Rajasthan Solar Package 1"
                                        className="w-full h-12 px-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                {/* Deal Type + Sector */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Deal Type</label>
                                        <select
                                            value={form.deal_type}
                                            onChange={e => set('deal_type', e.target.value)}
                                            className="w-full h-12 px-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                                        >
                                            {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Sector</label>
                                        <select
                                            value={form.sector}
                                            onChange={e => set('sector', e.target.value)}
                                            className="w-full h-12 px-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                                        >
                                            {SECTORS.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Capacity + Counterparty */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Capacity</label>
                                        <input
                                            value={form.capacity}
                                            onChange={e => set('capacity', e.target.value)}
                                            placeholder="e.g. 400 MW"
                                            className="w-full h-12 px-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Major Counterparty</label>
                                        <input
                                            value={form.counterparty}
                                            onChange={e => set('counterparty', e.target.value)}
                                            placeholder="e.g. RSEB, NHAI"
                                            className="w-full h-12 px-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="pt-2 flex items-center gap-3">
                                    <button type="button" onClick={onClose}
                                        className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={!form.name.trim() || isSubmitting}
                                        className={cn(
                                            "flex-[2] h-12 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50",
                                            "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                                        )}>
                                        {isSubmitting ? <span className="animate-pulse">Creating...</span> : <><Sparkles size={16} /> Initialize Deal</>}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Footer hint */}
                        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <p className="text-[11px] text-slate-500 font-bold">A dedicated intelligence workspace will be provisioned for this deal.</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
