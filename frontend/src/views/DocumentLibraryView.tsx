import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Eye, Clock, Database, FileUp, Trash2, Sparkles, Loader2, RefreshCcw } from 'lucide-react';
import type { Document, FileUpload } from '../types';
import { cn } from '../lib/utils';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Tooltip } from '../components/Tooltip';

interface DocumentLibraryViewProps {
    buId: string;
    documents: Document[];
    onUpload: (files: File[]) => Promise<void>;
    onGoToReconciliation: () => void;
    onDeleteDocument: (docId: string) => Promise<void>;
    onProcessDocuments: (forceReprocess?: boolean, filename?: string) => void;
    isProcessing?: boolean;
}

export function DocumentLibraryView({ buId, documents, onUpload, onGoToReconciliation, onDeleteDocument, onProcessDocuments, isProcessing = false }: DocumentLibraryViewProps) {
    const unprocessedDocs = documents.filter(d => d.status === 'uploaded');
    const [isHovering, setIsHovering] = useState(false);
    const [localFiles, setLocalFiles] = useState<FileUpload[]>([]);
    const [docToDelete, setDocToDelete] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleViewDocument = (filename: string) => {
        const url = `/viewer/${buId}/view/${encodeURIComponent(filename)}`;
        window.open(url, '_blank');
    };

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
            status: 'uploading',
            progress: 0,
            file: file
        }));

        setLocalFiles(prev => [...prev, ...newFiles]);

        // Simulate upload progress for each file
        newFiles.forEach(newFile => {
            let currentProgress = 0;
            const interval = setInterval(() => {
                currentProgress += Math.floor(Math.random() * 15) + 5; // Reaches 100 in roughly 1-2 seconds
                if (currentProgress >= 100) {
                    currentProgress = 100;
                    clearInterval(interval);
                    setLocalFiles(prev => prev.map(f =>
                        f.id === newFile.id ? { ...f, progress: 100, status: 'success' } : f
                    ));
                } else {
                    setLocalFiles(prev => prev.map(f =>
                        f.id === newFile.id ? { ...f, progress: currentProgress } : f
                    ));
                }
            }, 200);
        });
    };

    const handleUploadClick = async () => {
        const filesToUpload = localFiles.map(f => f.file).filter((f): f is File => !!f);
        if (filesToUpload.length > 0) {
            setIsSyncing(true);
            try {
                await onUpload(filesToUpload);
                setLocalFiles([]);
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const confirmDeletion = async () => {
        if (!docToDelete) return;
        setIsDeleting(true);
        try {
            await onDeleteDocument(docToDelete.id);
        } finally {
            setIsDeleting(false);
            setDocToDelete(null);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">Intelligence Ledger</p>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Document Library</h2>
                    <p className="text-slate-500 font-medium mt-1.5">Manage and upload raw source materials for this workspace.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-12 px-6 rounded-2xl bg-slate-50 text-slate-600 font-black text-xs flex items-center gap-2 border border-slate-100">
                        <Database size={16} /> {documents.length} Total Documents
                    </div>
                    {unprocessedDocs.length > 0 && (
                        <button
                            onClick={() => onProcessDocuments()}
                            disabled={isProcessing}
                            className={cn(
                                "h-12 px-6 rounded-2xl font-black text-xs flex items-center gap-2 transition-all",
                                isProcessing
                                    ? "bg-slate-700 text-slate-400 cursor-not-allowed shadow-none"
                                    : "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95"
                            )}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} /> Process {unprocessedDocs.length} Documents
                                </>
                            )}
                        </button>
                    )}
                    {documents.length > 0 && unprocessedDocs.length === 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onProcessDocuments(true)}
                                disabled={isProcessing}
                                className={cn(
                                    "h-12 px-6 rounded-2xl font-black text-xs flex items-center gap-2 transition-all border-2",
                                    isProcessing
                                        ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-white border-slate-200 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:scale-95"
                                )}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Reprocessing...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCcw size={16} /> Reprocess All
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onGoToReconciliation}
                                className="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                            >
                                <Sparkles size={16} /> Review Data Conflicts
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col gap-6 sticky top-8">
                    {/* Upload Area */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                        onDragLeave={() => setIsHovering(false)}
                        onDrop={(e) => { e.preventDefault(); setIsHovering(false); handleDrop(e); }}
                        className={cn(
                            "relative border-2 border-dashed rounded-[40px] p-10 flex flex-col items-center justify-center text-center gap-6 bg-white transition-all cursor-pointer group overflow-hidden",
                            isHovering
                                ? "border-blue-600 bg-blue-50/20 scale-[1.01] shadow-xl shadow-blue-100"
                                : "border-slate-100 hover:border-blue-300"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                            isHovering ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500"
                        )}>
                            <FileUp size={28} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-2">Add new artifacts</h3>
                            <p className="text-slate-400 text-sm font-medium px-4">Drag & drop or click to upload PDF, DOCX, or XLSX.</p>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    <AnimatePresence>
                        {localFiles.length > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-900 rounded-[32px] p-6 overflow-hidden shadow-2xl">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Queue ({localFiles.length})</span>
                                    <button onClick={() => setLocalFiles([])} className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors">Cancel All</button>
                                </div>
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {localFiles.map(file => (
                                        <div key={file.id} className="relative bg-slate-800 p-4 rounded-2xl border border-slate-700/50 overflow-hidden group">
                                            {/* Progress Bar Background */}
                                            <div
                                                className="absolute inset-y-0 left-0 bg-blue-600/20 transition-all duration-300 ease-out"
                                                style={{ width: `${file.progress}%` }}
                                            />

                                            <div className="relative flex items-center gap-4 z-10">
                                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-blue-400 shadow-inner">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-sm font-bold text-white truncate pr-4">{file.name}</span>
                                                        <span className="text-[10px] font-black text-blue-400">{file.progress}%</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-medium text-slate-400">{file.size}</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{file.status}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setLocalFiles(prev => prev.filter(f => f.id !== file.id)); }}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-all"
                                                    title="Cancel upload"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Progress Line */}
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-300 ease-out",
                                                        file.status === 'error' ? "bg-red-500" :
                                                            file.progress === 100 ? "bg-emerald-500" :
                                                                "bg-blue-500"
                                                    )}
                                                    style={{ width: `${file.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                                    disabled={isSyncing}
                                    className={cn(
                                        "w-full mt-6 h-12 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg",
                                        isSyncing
                                            ? "bg-slate-700 text-slate-400 cursor-not-allowed shadow-none"
                                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/50 active:scale-[0.98]"
                                    )}
                                >
                                    {isSyncing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <FileUp size={16} /> Sync
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-1 gap-4">
                        {documents.map((doc, i) => (
                            <motion.div
                                key={doc.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-6 group hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-100 transition-all"
                            >
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all scale-100 group-hover:scale-110 shrink-0">
                                    <FileText size={28} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="flex-1 min-w-0">
                                            <Tooltip content={doc.name}>
                                                <h3 className="font-black text-slate-900 truncate text-lg tracking-tight cursor-default">{doc.name}</h3>
                                            </Tooltip>
                                        </div>
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0",
                                            doc.status === 'processed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                        )}>
                                            {doc.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-5 text-slate-400">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Clock size={14} />
                                            <span className="text-xs font-bold">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 truncate">
                                            <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                            <span className="text-xs font-bold uppercase tracking-tight truncate">System UUID: {doc.id.split('-')[0]}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleViewDocument(doc.name)}
                                        title="View Reference"
                                        className="h-10 px-3 lg:px-4 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-blue-600 transition-all flex items-center gap-2 shadow-sm active:scale-95 group/btn"
                                    >
                                        <Eye size={16} className="group-hover/btn:scale-110 transition-transform" />
                                        <span className="hidden lg:inline">View</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onProcessDocuments(true, doc.name);
                                        }}
                                        disabled={isProcessing}
                                        title={doc.status === 'processed' ? "Reprocess Document" : "Process Document"}
                                        className={cn(
                                            "h-10 px-3 lg:px-4 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm active:scale-95 group/btn border shrink-0",
                                            isProcessing ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed shadow-none" : "bg-white border-blue-100 text-blue-600 hover:bg-blue-50"
                                        )}
                                    >
                                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} className="group-hover/btn:scale-110 transition-transform" />}
                                        <span className="hidden lg:inline">{doc.status === 'processed' ? "Reprocess" : "Process"}</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDocToDelete({ id: doc.id, name: doc.name });
                                        }}
                                        className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-colors"
                                        title="Delete Document"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}

                        {documents.length === 0 && localFiles.length === 0 && (
                            <div className="py-20 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-300">
                                    <FileText size={32} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">No Documents Found</h3>
                                    <p className="text-slate-400 text-sm font-medium">Please upload documents to the Nexus Generator first.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={!!docToDelete}
                documentName={docToDelete?.name || ''}
                isDeleting={isDeleting}
                onClose={() => !isDeleting && setDocToDelete(null)}
                onConfirm={confirmDeletion}
            />
        </motion.div>
    );
}
