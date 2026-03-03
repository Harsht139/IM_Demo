import { useEffect, useState } from 'react';
import { ChevronLeft, FileText } from 'lucide-react';
import PDFViewer from '../components/PDFViewer';
import { ExcelViewer } from '../components/ExcelViewer';

export function DocumentViewerView({ buId, filename }: { buId: string; filename: string }) {
    const [pageNumber, setPageNumber] = useState(1);
    const [highlight, setHighlight] = useState<any>();
    const [excelContext, setExcelContext] = useState<string | null>(null);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash) {
                const params = new URLSearchParams(hash);
                const page = params.get('page');
                const coords = params.get('coords');
                const ctx = params.get('context');

                if (page) setPageNumber(parseInt(page, 10));
                if (coords) {
                    try {
                        setHighlight(JSON.parse(decodeURIComponent(coords)));
                    } catch (e) {
                        console.error('Error parsing coordinates:', e);
                    }
                }
                if (ctx) setExcelContext(decodeURIComponent(ctx));
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const fileUrl = `/api/business-units/${buId}/files/${filename}`;

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
            <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 text-white shrink-0 shadow-sm relative z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.close()}
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-blue-400" />
                        <h1 className="font-bold text-sm truncate max-w-md">{decodeURIComponent(filename)}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-xs font-medium bg-slate-700/50 px-2 py-1 rounded">Page {pageNumber}</span>
                    <div className="text-xs font-medium text-slate-400">
                        Pinpoint Reference Viewer
                    </div>
                </div>
            </div>

            {filename.toLowerCase().endsWith('.pdf') ? (
                <PDFViewer
                    url={fileUrl}
                    pageNumber={pageNumber}
                    highlight={highlight}
                />
            ) : filename.toLowerCase().match(/\.(xlsx|xls|csv)$/) ? (
                <ExcelViewer url={fileUrl} highlightCell={excelContext || undefined} />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-slate-400 space-y-6">
                    <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center text-slate-500 shadow-xl border border-slate-700">
                        <FileText size={48} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">Preview Not Available</h2>
                        <p className="text-slate-400 font-medium">
                            Inline reference highlighting is currently only supported for PDF documents. <br />
                            This is a {filename.split('.').pop()?.toUpperCase()} file.
                        </p>
                    </div>
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 px-8 py-3 bg-blue-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/50"
                        download
                    >
                        Download Original File
                    </a>
                </div>
            )}
        </div>
    );
}
