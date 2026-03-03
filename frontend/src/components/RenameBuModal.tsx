import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface RenameBuModalProps {
    isOpen: boolean;
    initialName: string;
    isRenaming: boolean;
    onClose: () => void;
    onConfirm: (newName: string) => void;
}

export function RenameBuModal({ isOpen, initialName, isRenaming, onClose, onConfirm }: RenameBuModalProps) {
    const [newName, setNewName] = useState(initialName);

    useEffect(() => {
        if (isOpen) {
            setNewName(initialName);
        }
    }, [isOpen, initialName]);

    const handleConfirm = () => {
        if (newName.trim() && newName !== initialName) {
            onConfirm(newName.trim());
        } else {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isRenaming ? onClose : undefined}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
                    >
                        {/* Header Area */}
                        <div className="p-8 pb-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                    <Pencil className="text-blue-600 w-6 h-6" />
                                </div>
                                <button
                                    onClick={onClose}
                                    disabled={isRenaming}
                                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <h2 className="text-xl font-black text-slate-900 mb-2">Rename Workspace</h2>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
                                Enter a new name for your business unit.
                            </p>

                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleConfirm();
                                    }
                                }}
                                disabled={isRenaming}
                                autoFocus
                                className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Workspace Name"
                            />
                        </div>

                        {/* Actions Area */}
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={isRenaming}
                                className="px-5 h-11 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isRenaming || !newName.trim() || newName === initialName}
                                className={cn(
                                    "px-6 h-11 rounded-xl font-black text-sm text-white flex items-center gap-2 shadow-lg transition-all active:scale-95",
                                    "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
                                    (isRenaming || !newName.trim() || newName === initialName) && "opacity-50 cursor-not-allowed active:scale-100"
                                )}
                            >
                                {isRenaming ? (
                                    <span className="animate-pulse">Saving...</span>
                                ) : (
                                    <>
                                        <Check size={16} /> Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
