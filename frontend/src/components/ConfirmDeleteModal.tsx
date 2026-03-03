
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    documentName: string;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function ConfirmDeleteModal({ isOpen, documentName, isDeleting, onClose, onConfirm }: ConfirmDeleteModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isDeleting ? onClose : undefined}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
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
                                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="text-red-600 w-6 h-6" />
                                </div>
                                <button
                                    onClick={onClose}
                                    disabled={isDeleting}
                                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <h2 className="text-xl font-black text-slate-900 mb-2">Delete Document</h2>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                Are you sure you want to permanently delete <span className="text-slate-900 font-bold">{documentName}</span>? This action cannot be undone and will remove it from the intelligence workspace.
                            </p>
                        </div>

                        {/* Actions Area */}
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={isDeleting}
                                className="px-5 h-11 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isDeleting}
                                className={cn(
                                    "px-6 h-11 rounded-xl font-black text-sm text-white flex items-center gap-2 shadow-lg transition-all active:scale-95",
                                    "bg-red-600 hover:bg-red-700 shadow-red-200",
                                    isDeleting && "opacity-70 cursor-not-allowed active:scale-100"
                                )}
                            >
                                {isDeleting ? (
                                    <span className="animate-pulse">Deleting...</span>
                                ) : (
                                    <>
                                        <Trash2 size={16} /> Delete Forever
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
