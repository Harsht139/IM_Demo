import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle2, ShieldCheck, Sparkles, Download, FileJson as DocIcon, File as PdfIcon, ChevronDown, Cloud as DriveIcon, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { IMSection, IMSource } from '../types';
import { cn } from '../lib/utils';
import { usePreloadDocuments } from '../hooks/usePreloadDocuments';
import { intelligenceApi } from '../api';

export function FinalPreviewView({
    sections,
    sources,
    projectStatus,
    buId,
    dealId,
    projectName,
    onUpdateSections,
    onDeleteIM,
    onRegenerateAll,
    isGenerating,
}: {
    sections: IMSection[],
    sources: IMSource[],
    projectStatus: string,
    buId: string,
    dealId: string,
    projectName: string,
    onUpdateSections: (sections: IMSection[]) => void,
    onDeleteIM: () => Promise<void>,
    onRegenerateAll?: () => void,
    isGenerating?: boolean;
}) {
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const [isDriveUploading, setIsDriveUploading] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [showDeleteIMModal, setShowDeleteIMModal] = useState(false);
    const [isDeletingIM, setIsDeletingIM] = useState(false);
    const [regenerationLoading, setRegenerationLoading] = useState<Record<string, boolean>>({});
    const [selectedTone, setSelectedTone] = useState<Record<string, string>>({});

    // Predictive pre-fetching for all source documents
    const allFilenames = Array.from(new Set(sources.map(s => s.source_file).filter(Boolean) as string[]));
    usePreloadDocuments(buId, allFilenames);

    if (sections.length === 0) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 space-y-6 text-center max-w-lg mx-auto">
                <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-100">
                    <FileText size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">IM Synthesis Pending</h3>
                    <p className="text-slate-500 font-medium mt-2 leading-relaxed">
                        Final Information Memorandum sections will appear here once the reconciliation process is completed.
                    </p>
                </div>
            </motion.div>
        );
    }


    const handleDownload = async (format: 'docx' | 'pdf') => {
        setIsExporting(format);
        try {
            const payload = { sections, sources, project_name: projectName, business_unit_id: buId, deal_id: dealId };
            const response = await intelligenceApi.exportDownload(payload, format);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Information_Memorandum.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            }
            setIsDownloadMenuOpen(false);
        } catch (e) {
            console.error("Download failed", e);
        } finally {
            setIsExporting(null);
        }
    };

    const handleExportToDrive = async (format: 'docx' | 'pdf' | 'gdoc' = 'docx') => {
        setIsDriveUploading(format);
        try {
            const payload = { sections, sources, project_name: projectName, business_unit_id: buId, deal_id: dealId };
            const result = await intelligenceApi.exportToDrive(buId, payload, format);
            if (result.drive_url) {
                // For Google Docs, ensure we open in the editor mode
                if (format === 'gdoc') {
                    // Convert to Google Docs editor URL if needed
                    const gdocUrl = result.drive_url.includes('/docs.google.com/document/')
                        ? result.drive_url
                        : result.drive_url.replace('/drive.google.com/file/d/', '/docs.google.com/document/d/').replace('/view', '/edit');
                    window.open(gdocUrl, '_blank');
                } else {
                    window.open(result.drive_url, '_blank');
                }
            }
        } catch (err) {
            console.error("Drive upload failed", err);
        } finally {
            setIsDriveUploading(null);
            setIsDownloadMenuOpen(false);
        }
    };

    const handleDeleteIM = async () => {
        setIsDeletingIM(true);
        try {
            await onDeleteIM();
            setShowDeleteIMModal(false);
        } catch (err) {
            console.error("Delete IM failed", err);
        } finally {
            setIsDeletingIM(false);
        }
    };

    const handleRegenerateSection = async (sectionId: string) => {
        const tone = selectedTone[sectionId] || "Standard";
        setRegenerationLoading(prev => ({ ...prev, [sectionId]: true }));
        try {
            const result = await intelligenceApi.regenerateSection(buId, sectionId, tone);
            const newSection = result.section;
            const updatedSections = sections.map(s => s.id === sectionId ? newSection : s);
            onUpdateSections(updatedSections);
        } catch (err) {
            console.error("Regeneration failed", err);
        } finally {
            setRegenerationLoading(prev => ({ ...prev, [sectionId]: false }));
        }
    };


    const handleNavigateToSource = (num: number) => {
        const sourceObj = sources.find(s => parseInt(s.number as unknown as string) === num);
        if (sourceObj && sourceObj.source_file) {
            const hashParts: string[] = [];
            if (sourceObj.page_number) hashParts.push(`page=${sourceObj.page_number}`);
            if (sourceObj.coordinates) {
                let coordObj = null;
                if (Array.isArray(sourceObj.coordinates) && (sourceObj.coordinates as number[]).length === 4) {
                    const [x1, y1, x2, y2] = sourceObj.coordinates as number[];
                    coordObj = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
                } else {
                    coordObj = sourceObj.coordinates;
                }
                if (coordObj) hashParts.push(`coords=${encodeURIComponent(JSON.stringify(coordObj))}`);
            }

            const isExcel = sourceObj.source_file.toLowerCase().match(/\.(xlsx|xls|csv)$/);
            if (isExcel && sourceObj.context && sourceObj.context.includes('!')) {
                hashParts.push(`context=${encodeURIComponent(sourceObj.context)}`);
            }
            const hash = hashParts.length > 0 ? `#${hashParts.join('&')}` : '';
            const filename = encodeURIComponent(sourceObj.source_file);
            window.open(`/viewer/${buId}/view/${filename}${hash}`, '_blank');
        } else {
            const el = document.getElementById(`ref-${num}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const renderWithCitations = (text: string) => {
        // Matches [index: 1 | source: ...] or [1] or [1, 2] or (1)
        // Improved regex to handle various bracket types, pipes, and internal descriptive text
        const parts = text.split(/(\[[\d][^\]]*\]|\([\d\s,]+\))/g);
        return parts.map((part, i) => {
            // Flexible match for [1] or [1 | Source] or (1)
            const match = part.match(/[\[\(](?:index:\s*)?([\d\s,]+)(?:\s*[|:]\s*(?:source:)?\s*([^\]\)]*))?[\]\)]/i);
            if (match) {
                const inner = match[1];
                const sourceInfo = match[2];
                const nums = inner.split(',').map(n => n.trim()).filter(Boolean);

                return (
                    <span key={i} className="whitespace-nowrap inline-flex items-center">
                        <span className="text-[10px] text-slate-400 font-bold ml-1 mr-0.5">[</span>
                        {nums.map((numStr, idx) => {
                            const num = parseInt(numStr);
                            return (
                                <React.Fragment key={idx}>
                                    <sup
                                        className="text-blue-600 hover:text-blue-900 font-black cursor-pointer transition-all hover:underline decoration-blue-400 decoration-1"
                                        onClick={() => handleNavigateToSource(num)}
                                    >
                                        {num}
                                    </sup>
                                    {idx < nums.length - 1 && <span className="text-[10px] text-slate-400">, </span>}
                                </React.Fragment>
                            );
                        })}
                        {sourceInfo && (
                            <span
                                className="text-[9px] font-bold text-slate-500 ml-1 hover:text-blue-600 transition-colors cursor-pointer italic"
                                onClick={() => handleNavigateToSource(parseInt(nums[0]))}
                            >
                                | {sourceInfo}
                            </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-bold ml-0.5 mr-1">]</span>
                    </span>
                );
            }
            return part;
        });
    };

    const isLocked = projectStatus === 'COMMITTEE_REVIEW' || projectStatus === 'APPROVED';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 pb-32 relative">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className={cn(
                        "w-16 h-16 rounded-[28px] flex items-center justify-center border shadow-lg",
                        isLocked ? "bg-blue-50 text-blue-600 border-blue-100 shadow-blue-50" : "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-50"
                    )}>
                        <CheckCircle2 size={32} />
                    </div>
                    <div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Information Memorandum Draft</h2>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    {onRegenerateAll && (
                        <button
                            onClick={onRegenerateAll}
                            disabled={isGenerating}
                            className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 size={18} className="text-blue-600 animate-spin" /> : <Sparkles size={18} className="text-blue-600" />}
                            {isGenerating ? 'Synthesizing...' : 'Regenerate All'}
                        </button>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                            className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Download size={18} /> Export <ChevronDown size={14} className={cn("transition-transform", isDownloadMenuOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {isDownloadMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-14 right-0 w-48 bg-white rounded-2xl border border-slate-100 shadow-2xl z-[50] py-2"
                                >
                                    <button
                                        onClick={() => handleDownload('docx')}
                                        disabled={!!isExporting || !!isDriveUploading}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 text-sm font-bold disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                            {isExporting === 'docx' ? <Loader2 size={16} className="animate-spin" /> : <DocIcon size={16} />}
                                        </div>
                                        {isExporting === 'docx' ? 'Generating...' : 'Word Document'}
                                    </button>
                                    <button
                                        onClick={() => handleDownload('pdf')}
                                        disabled={!!isExporting || !!isDriveUploading}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 text-sm font-bold disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                                            {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <PdfIcon size={16} />}
                                        </div>
                                        {isExporting === 'pdf' ? 'Generating...' : 'PDF Portfolio'}
                                    </button>
                                    <div className="h-px bg-slate-100 mx-3 my-1" />
                                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cloud Sync</div>
                                    <button
                                        onClick={() => handleExportToDrive('docx')}
                                        disabled={!!isDriveUploading || !!isExporting}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 text-sm font-bold disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            {isDriveUploading === 'docx' ? <Loader2 size={16} className="animate-spin" /> : <DriveIcon size={16} />}
                                        </div>
                                        {isDriveUploading === 'docx' ? 'Syncing...' : 'Save Word to Drive'}
                                    </button>
                                    <button
                                        onClick={() => handleExportToDrive('pdf')}
                                        disabled={!!isDriveUploading || !!isExporting}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 text-sm font-bold disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            {isDriveUploading === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <DriveIcon size={16} />}
                                        </div>
                                        {isDriveUploading === 'pdf' ? 'Syncing...' : 'Save PDF to Drive'}
                                    </button>
                                    <button
                                        onClick={() => handleExportToDrive('gdoc')}
                                        disabled={!!isDriveUploading || !!isExporting}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-50 transition-colors text-emerald-700 text-sm font-black italic disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                            {isDriveUploading === 'gdoc' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        </div>
                                        {isDriveUploading === 'gdoc' ? 'Converting & Opening...' : 'Open in Google Docs'}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Delete IM — always visible regardless of lock status */}
                    <button
                        onClick={() => setShowDeleteIMModal(true)}
                        className="h-12 px-5 rounded-2xl bg-white border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Trash2 size={16} /> Delete IM
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[48px] shadow-2xl shadow-slate-200/50 p-20 relative border border-slate-100 flex gap-12 group overflow-hidden">
                {/* Fixed TOC */}
                <div className="w-48 shrink-0 py-4 hidden lg:block sticky top-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">IM STRUCTURE</p>
                    <div className="space-y-4">
                        {sections.map((s, i) => (
                            <div
                                key={i}
                                onClick={() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                                className="group/nav flex items-center gap-3 cursor-pointer"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover/nav:bg-blue-600 transition-all" />
                                <span className="text-[11px] font-bold text-slate-400 group-hover/nav:text-slate-900 uppercase truncate transition-colors">{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* IM Document Body */}
                <div className="flex-1 max-w-2xl bg-white border-x border-slate-100 px-16 space-y-20 relative z-10">
                    <div className="text-center pb-20 border-b-4 border-slate-900">
                        <p className="text-[#94A3B8] font-black uppercase tracking-[0.6em] text-[10px] mb-10">Confidential Private Offering</p>
                        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-8 uppercase">Information <br /> Memorandum</h1>
                        <div className="flex items-center justify-center gap-4 mt-12 bg-slate-50 py-3 rounded-2xl border border-slate-100/50">
                            <ShieldCheck className="text-slate-900" size={16} />
                            <p className="font-bold text-sm text-slate-500 uppercase tracking-widest">{projectName}</p>
                        </div>
                    </div>

                    <div className="space-y-24">
                        {sections.map((section, idx) => (
                            <div key={idx} id={`section-${section.id}`} className="space-y-8 relative group/section scroll-mt-12">
                                <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-[12px] font-black text-blue-600 uppercase tracking-[0.3em]">{section.title}</h3>
                                        {!isLocked && (
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <select
                                                    value={selectedTone[section.id] || "Standard"}
                                                    onChange={(e) => setSelectedTone(prev => ({ ...prev, [section.id]: e.target.value }))}
                                                    className="text-[9px] font-black bg-slate-50 border-none rounded-md px-1.5 py-0.5 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer outline-none"
                                                >
                                                    <option value="Standard">Standard Tone</option>
                                                    <option value="Conservative">Conservative</option>
                                                    <option value="Strong">Strong/Growth</option>
                                                </select>
                                                <button
                                                    onClick={() => handleRegenerateSection(section.id as string)}
                                                    disabled={regenerationLoading[section.id]}
                                                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
                                                >
                                                    {regenerationLoading[section.id] ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : (
                                                        <Sparkles size={10} className="text-blue-500" />
                                                    )}
                                                    Regenerate
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-300 group-hover/section:text-slate-400 transition-colors uppercase">Section 0{idx + 1}</span>
                                </div>
                                <div className="relative prose prose-slate max-w-none prose-p:text-lg prose-p:leading-[1.7] prose-p:text-slate-800 prose-p:font-medium prose-p:font-serif prose-li:text-lg prose-li:text-slate-800 prose-li:font-serif prose-headings:font-black prose-headings:text-slate-900 prose-strong:font-black prose-strong:text-slate-900 prose-ul:my-4 prose-p:first-of-type:first-letter:text-4xl prose-p:first-of-type:first-letter:font-black prose-p:first-of-type:first-letter:mr-1 prose-p:first-of-type:first-letter:float-left prose-p:first-of-type:first-letter:leading-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ children }: { children?: React.ReactNode }) => {
                                                return <p className="mb-6">{React.Children.map(children, child => {
                                                    if (typeof child === 'string') return renderWithCitations(child);
                                                    return child;
                                                })}</p>
                                            },
                                            li: ({ children }: { children?: React.ReactNode }) => {
                                                return <li className="mb-2">{React.Children.map(children, child => {
                                                    if (typeof child === 'string') return renderWithCitations(child);
                                                    return child;
                                                })}</li>
                                            },
                                            strong: ({ children }: { children?: React.ReactNode }) => {
                                                return <strong className="font-black text-slate-900">{React.Children.map(children, child => {
                                                    if (typeof child === 'string') return renderWithCitations(child);
                                                    return child;
                                                })}</strong>
                                            },
                                            em: ({ children }: { children?: React.ReactNode }) => {
                                                return <em className="italic">{React.Children.map(children, child => {
                                                    if (typeof child === 'string') return renderWithCitations(child);
                                                    return child;
                                                })}</em>
                                            }
                                        }}
                                    >
                                        {section.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}

                        {/* Full-width divider instead of References section */}
                        <div className="pt-8 border-t border-slate-100" />
                    </div>
                </div>
            </div>

            {/* Full Page Synthesis Loading Overlay */}
            <AnimatePresence>
                {isGenerating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-white/60 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="relative mb-8">
                            <div className="w-24 h-24 rounded-[32px] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-200">
                                <Sparkles size={40} className="animate-pulse" />
                            </div>
                            <div className="absolute -inset-4 bg-blue-500/10 rounded-[40px] animate-ping" />
                        </div>
                        <div className="space-y-4 max-w-sm">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nexus AI Synthesis</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">
                                Regenerating deal sections and cross-referencing sources for a high-fidelity Information Memorandum...
                            </p>
                            <div className="pt-4 flex items-center justify-center gap-3">
                                <Loader2 size={24} className="text-blue-600 animate-spin" />
                                <div className="flex gap-1">
                                    <motion.div
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                        className="w-1.5 h-1.5 rounded-full bg-blue-600"
                                    />
                                    <motion.div
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                        className="w-1.5 h-1.5 rounded-full bg-blue-600"
                                    />
                                    <motion.div
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                        className="w-1.5 h-1.5 rounded-full bg-blue-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete IM Confirmation Modal */}
            <AnimatePresence>
                {showDeleteIMModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-[48px] p-12 max-w-md w-full text-center space-y-6 shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[28px] flex items-center justify-center border border-red-100 shadow-xl mx-auto">
                                <AlertTriangle size={36} />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Delete Information Memorandum?</h3>
                                <p className="text-slate-500 font-medium leading-relaxed">
                                    This will permanently erase the synthesized IM and reset this deal to its initial state. Your uploaded documents will be preserved.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteIMModal(false)}
                                    className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteIM}
                                    disabled={isDeletingIM}
                                    className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeletingIM ? <span className="animate-pulse">Deleting...</span> : <><Trash2 size={16} /> Delete IM</>}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
