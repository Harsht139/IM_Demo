import { useState, useRef, type Dispatch, type SetStateAction, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, FileText, CheckCircle, Loader2, Trash2, ChevronRight } from 'lucide-react';
import type { FileUpload } from '../types';
import { cn } from '../lib/utils';

export function UploadView({ files, setFiles, onComplete }: { files: FileUpload[], setFiles: Dispatch<SetStateAction<FileUpload[]>>, onComplete: (files: File[]) => void }) {
    const [isHovering, setIsHovering] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: DragEvent) => {
        const incoming = Array.from(e.dataTransfer.files);
        addFiles(incoming);
    };

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        addFiles(Array.from(e.target.files));
    };

    const addFiles = (incoming: File[]) => {
        const newFiles: FileUpload[] = incoming.map(file => ({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
            type: file.name.split('.').pop()?.toUpperCase() || 'PDF',
            status: 'success',
            progress: 100,
            file: file
        }));
        setFiles(prev => [...prev, ...newFiles]);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-3xl mx-auto">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={(e) => { e.preventDefault(); setIsHovering(false); handleDrop(e); }}
                className={cn(
                    "relative border-2 border-dashed rounded-[40px] p-16 flex flex-col items-center justify-center bg-white transition-all cursor-pointer group overflow-hidden",
                    isHovering
                        ? "border-blue-600 bg-blue-50/20 scale-[1.02] shadow-2xl shadow-blue-100"
                        : "border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-100"
                )}
            >
                <div className={cn(
                    "w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500",
                    isHovering ? "bg-blue-600 text-white rotate-12" : "bg-slate-50 text-slate-300 group-hover:bg-slate-100 group-hover:text-blue-500"
                )}>
                    <FileUp size={40} />
                </div>

                <div className="text-center space-y-3 px-4">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Drop deal artifacts here</h2>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm mx-auto">
                        Drag and drop PDFs, Scanned documents, or Excel models. Our engine will perform high-fidelity extraction and reconciliation.
                    </p>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-10 bg-blue-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-[0_15px_30px_rgba(37,99,235,0.2)] active:scale-95 cursor-pointer"
                >
                    Select Documents
                    <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept=".pdf,.docx,.xlsx,.csv,.txt"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                </button>

                <div className="mt-8 flex gap-6">
                    <FormatBadge label="PDF" />
                    <FormatBadge label="XLSX" />
                    <FormatBadge label="DOCX" />
                    <FormatBadge label="MAX 50MB" />
                </div>

                {/* Decorative elements */}
                <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-blue-50 rounded-full blur-[80px] opacity-60" />
                <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-emerald-50 rounded-full blur-[80px] opacity-60" />
            </div>

            <AnimatePresence>
                {files.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Document Queue ({files.length})</h3>
                            <button onClick={() => setFiles([])} className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors">Clear All</button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {files.map(file => (
                                <motion.div
                                    layout
                                    key={file.id}
                                    className="bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] rounded-2xl p-4 flex items-center gap-4 group hover:border-slate-300 transition-all"
                                >
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                                        <FileText className="text-slate-400 group-hover:text-blue-600 transition-colors" size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex flex-col truncate">
                                                <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                                                <select
                                                    value={file.docType || 'other'}
                                                    onChange={(e) => {
                                                        const val = e.target.value as FileUpload['docType'];
                                                        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, docType: val } : f));
                                                    }}
                                                    className="mt-1 text-[10px] bg-slate-50 border-none rounded-md px-1.2 py-0.5 text-slate-500 font-bold focus:ring-1 focus:ring-blue-100 w-fit"
                                                >
                                                    <option value="other">Document Type</option>
                                                    <option value="credit_summary">Credit Summary</option>
                                                    <option value="sanction_letter">Sanction Letter</option>
                                                    <option value="financial_model">Financial Model</option>
                                                </select>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{file.size}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${file.progress}%` }}
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-300",
                                                    file.status === 'success' ? "bg-emerald-500" : "bg-blue-600"
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        {file.status === 'success' ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                                                    <CheckCircle size={18} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 flex items-center justify-center">
                                                <Loader2 size={18} className="text-blue-600 animate-spin" />
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <button
                            onClick={() => onComplete(files.map(f => f.file).filter((f): f is File => !!f))}
                            disabled={files.some(f => f.status === 'uploading')}
                            className="w-full mt-6 bg-blue-600 text-white h-14 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-3 group active:scale-[0.98]"
                        >
                            Launch Analysis Engine <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function FormatBadge({ label }: { label: string }) {
    return <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-1">{label}</span>;
}
