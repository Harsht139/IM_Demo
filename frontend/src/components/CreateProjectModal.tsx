import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface CreateBusinessUnitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateBusinessUnitModal({ isOpen, onClose, onCreate }: CreateBusinessUnitModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onCreate(name, description);
            setName('');
            setDescription('');
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-[32px] shadow-[0_32px_96px_-16px_rgba(15,23,42,0.16)] border border-slate-100 overflow-hidden"
                    >
                        {/* Header Decoration */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-50/50 via-white to-white -z-10" />

                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                        <FolderPlus className="text-white w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Create Business Unit</h2>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-0.5">Define your organizational unit</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Business Unit Name
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Solar Farm Alpha Acquisition"
                                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300 shadow-inner"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Briefly describe the business unit objectives..."
                                        className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none font-medium text-slate-900 transition-all placeholder:text-slate-300 shadow-inner resize-none"
                                    />
                                </div>

                                <div className="pt-4 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 h-14 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!name.trim() || isSubmitting}
                                        className={cn(
                                            "flex-[2] h-14 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale",
                                            "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                                        )}
                                    >
                                        {isSubmitting ? (
                                            <span className="animate-pulse">Creating...</span>
                                        ) : (
                                            <>
                                                <Sparkles size={18} /> Initialize Unit
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Insight Footer */}
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                Business Unit initialization allocates a dedicated intelligence workspace and synthesis scaffolding.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
