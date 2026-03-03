import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isVisible && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
            });
        }
    }, [isVisible]);

    return (
        <>
            <div
                ref={containerRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="w-full truncate"
            >
                {children}
            </div>

            {isVisible && (
                <div
                    className="fixed z-[100] pointer-events-none"
                    style={{ top: position.top, left: position.left, transform: 'translate(-50%, -100%)' }}
                >
                    <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                        {content}
                        <div className="absolute left-1/2 bottom-0 -mb-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                    </div>
                </div>
            )}
        </>
    );
}
