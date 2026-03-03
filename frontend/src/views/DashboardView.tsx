import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, FileText, Database, Activity, Plus, ChevronRight, Clock, Trash2, Pencil } from 'lucide-react';
import type { DashboardStats, BusinessUnitSummary } from '../types';
import { RenameBuModal } from '../components/RenameBuModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface DashboardViewProps {
    stats: DashboardStats;
    businessUnits: BusinessUnitSummary[];
    onSelectBusinessUnit: (id: string) => void;
    onCreateBusinessUnit: () => void;
    onDeleteBusinessUnit: (id: string) => void;
    onEditBusinessUnit: (id: string, name: string) => void;
}

export function DashboardView({ stats, businessUnits, onSelectBusinessUnit, onCreateBusinessUnit, onDeleteBusinessUnit, onEditBusinessUnit }: DashboardViewProps) {
    const [renameBu, setRenameBu] = useState<BusinessUnitSummary | null>(null);
    const [deleteBu, setDeleteBu] = useState<BusinessUnitSummary | null>(null);

    // Assuming onEdit/onDelete completes synchronously in terms of UI state update from App.tsx
    const [isProcessing, setIsProcessing] = useState(false);
    const cards = [
        { label: 'Business Units', value: stats.total_projects, icon: <LayoutDashboard className="text-blue-600" />, color: 'bg-blue-50' },
        { label: 'Documents Processed', value: stats.total_documents, icon: <FileText className="text-emerald-600" />, color: 'bg-emerald-50' },
        { label: 'AI Syntheses', value: stats.total_sections_generated, icon: <Database className="text-purple-600" />, color: 'bg-purple-50' },
        { label: 'Active Business Units', value: stats.active_engagements, icon: <Activity className="text-amber-600" />, color: 'bg-amber-50' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                        <div className={`w-14 h-14 rounded-2xl ${card.color} flex items-center justify-center`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Active Business Units</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Manage your business units and document intelligence.</p>
                    </div>
                    <button
                        onClick={onCreateBusinessUnit}
                        className="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg active:scale-95"
                    >
                        <Plus size={18} /> New Business Unit
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {businessUnits.map((bu) => (
                        <div
                            key={bu.id}
                            onClick={() => onSelectBusinessUnit(bu.id)}
                            className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText size={24} />
                                </div>
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-widest">
                                    {bu.status}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRenameBu(bu);
                                    }}
                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Rename Workspace"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteBu(bu);
                                    }}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Delete Business Unit"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 truncate">{bu.name}</h3>
                            <div className="flex items-center gap-4 text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <Database size={14} />
                                    <span className="text-xs font-bold">{bu.document_count} Documents</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    <span className="text-xs font-bold">{new Date(bu.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Enter Workspace</span>
                                <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-colors translate-x-0 group-hover:translate-x-1" />
                            </div>
                        </div>
                    ))}

                    {businessUnits.length === 0 && (
                        <div className="col-span-full py-20 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-300">
                                <LayoutDashboard size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">No Business Units Found</h3>
                                <p className="text-slate-400 text-sm font-medium">Create your first business unit to start synthesizing documents.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <RenameBuModal
                isOpen={!!renameBu}
                initialName={renameBu?.name || ''}
                isRenaming={isProcessing}
                onClose={() => !isProcessing && setRenameBu(null)}
                onConfirm={async (newName) => {
                    if (!renameBu) return;
                    setIsProcessing(true);
                    try {
                        await onEditBusinessUnit(renameBu.id, newName);
                        setRenameBu(null);
                    } finally {
                        setIsProcessing(false);
                    }
                }}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteBu}
                documentName={deleteBu?.name || ''}
                isDeleting={isProcessing}
                onClose={() => !isProcessing && setDeleteBu(null)}
                onConfirm={async () => {
                    if (!deleteBu) return;
                    setIsProcessing(true);
                    try {
                        await onDeleteBusinessUnit(deleteBu.id);
                        setDeleteBu(null);
                    } finally {
                        setIsProcessing(false);
                    }
                }}
            />
        </motion.div>
    );
}
