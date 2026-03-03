import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '../lib/utils';

// Try standard URL definition for Vite to bundle the worker automatically
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
).toString();

interface PDFViewerProps {
    url: string;
    pageNumber?: number;
    highlight?: any; // Can be single {x,y,w,h} or Array of {x,y,w,h}
}

const PDFPage: React.FC<{
    pdf: pdfjsLib.PDFDocumentProxy;
    pageNumber: number;
    highlight?: any;
    isTargetPage: boolean;
}> = ({ pdf, pageNumber, highlight, isTargetPage }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const [viewport, setViewport] = useState<pdfjsLib.PageViewport | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isRendered, setIsRendered] = useState(false);

    // 1. Intersection Observer to detect visibility
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1, rootMargin: '400px' } // Load a bit early
        );

        if (pageRef.current) observer.observe(pageRef.current);
        return () => observer.disconnect();
    }, []);

    // 2. Prioritized Render Logic
    useEffect(() => {
        // Only render if it's the target page OR it has become visible
        if (!isTargetPage && !isVisible) return;
        if (isRendered) return;

        let active = true;
        let renderTask: any = null;

        const render = async () => {
            try {
                const page = await pdf.getPage(pageNumber);
                if (!active) return;

                const canvas = canvasRef.current;
                if (!canvas) return;

                // Scale for high quality, but maintain aspect ratio for skeleton consistency
                const vp = page.getViewport({ scale: 1.5 });
                setViewport(vp);

                canvas.height = vp.height;
                canvas.width = vp.width;

                const context = canvas.getContext('2d', { alpha: false })!;
                renderTask = page.render({
                    canvasContext: context,
                    viewport: vp,
                });

                await renderTask.promise;
                if (active) setIsRendered(true);
            } catch (err: any) {
                if (active && err.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNumber}:`, err);
                }
            }
        };

        render();
        return () => {
            active = false;
            if (renderTask) renderTask.cancel();
        };
    }, [pdf, pageNumber, isVisible, isTargetPage, isRendered]);

    // 3. Immediate Scrolling logic
    useEffect(() => {
        if (isTargetPage && pageRef.current) {
            // Priority scroll: don't wait for render
            pageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isTargetPage]);

    // 4. Precise Highlight Scrolling (Wait for viewport/render)
    const highlightRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isTargetPage && highlight && isRendered && highlightRef.current) {
            const scrollTimeout = setTimeout(() => {
                highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            return () => clearTimeout(scrollTimeout);
        }
    }, [isTargetPage, highlight, isRendered]);

    return (
        <div
            ref={pageRef}
            className="relative shadow-2xl bg-white mb-8 border border-slate-700/30 overflow-hidden min-h-[800px] w-full max-w-[800px]"
            style={{
                aspectRatio: viewport ? `${viewport.width}/${viewport.height}` : '8.5/11'
            }}
        >
            {!isRendered && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50 animate-pulse">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mb-4" />
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Preparing Content...</div>
                </div>
            )}

            <canvas
                ref={canvasRef}
                className={cn(
                    "block relative z-0 w-full h-auto transition-opacity duration-500",
                    isRendered ? "opacity-100" : "opacity-0"
                )}
            />

            {isTargetPage && highlight && viewport && (
                <>
                    {(Array.isArray(highlight) ? highlight : [highlight]).map((box, idx) => {
                        // Handle both backend [x1, y1, x2, y2] and frontend {x, y, w, h} formats
                        let style = {};
                        if (Array.isArray(box) && box.length === 4) {
                            const [x1, y1, x2, y2] = box;
                            style = {
                                left: `${x1 * 100}%`,
                                top: `${y1 * 100}%`,
                                width: `${(x2 - x1) * 100}%`,
                                height: `${(y2 - y1) * 100}%`
                            };
                        } else if (box.x !== undefined) {
                            style = {
                                left: `${box.x * 100}%`,
                                top: `${box.y * 100}%`,
                                width: `${box.w * 100}%`,
                                height: `${box.h * 100}%`
                            };
                        }

                        return (
                            <motion.div
                                key={idx}
                                ref={idx === 0 ? highlightRef : null}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    boxShadow: ["0 0 20px rgba(234,179,8,0.3)", "0 0 40px rgba(234,179,8,0.6)", "0 0 20px rgba(234,179,8,0.3)"]
                                }}
                                transition={{
                                    boxShadow: {
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }
                                }}
                                className="absolute border-2 border-yellow-500 bg-yellow-400/40 pointer-events-none z-10"
                                style={style}
                            />
                        );
                    })}
                </>
            )}

            <div className="absolute top-2 right-2 px-2 py-1 bg-slate-900/50 rounded text-[10px] text-white/50 font-bold backdrop-blur-sm pointer-events-none z-20">
                Page {pageNumber}
            </div>
        </div>
    );
};

const PDFViewer: React.FC<PDFViewerProps> = ({ url, pageNumber = 1, highlight }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            try {
                // Optimize loading by disabling autoFetch and Stream.
                // This forces PDF.js to use byte-range requests for only the viewed data.
                const loadingTask = pdfjsLib.getDocument({
                    url,
                    disableAutoFetch: true,
                    disableStream: true,
                });
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setLoading(false);
            } catch (err) {
                console.error('Error loading PDF:', err);
                setError('Failed to load document.');
                setLoading(false);
            }
        };
        loadPdf();
    }, [url]);

    if (loading) return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4" />
            <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">Warming up document engine...</div>
        </div>
    );

    if (error) return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 p-8 text-center text-red-400">
            <div className="font-black mb-2 text-lg">⚠️ VIEWING ERROR</div>
            <div className="text-sm font-medium text-slate-500">{error}</div>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-900 p-8 flex flex-col items-center scroll-smooth custom-scrollbar"
        >
            <div className="max-w-4xl w-full flex flex-col items-center">
                {pdf && Array.from({ length: pdf.numPages }, (_, i) => (
                    <PDFPage
                        key={`${url}-p${i + 1}`}
                        pdf={pdf}
                        pageNumber={i + 1}
                        isTargetPage={i + 1 === pageNumber}
                        highlight={highlight}
                    />
                ))}
            </div>
        </div>
    );
};

export default PDFViewer;
