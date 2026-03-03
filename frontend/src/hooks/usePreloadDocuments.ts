import { useEffect } from 'react';

/**
 * Hook to predictive pre-fetch document URLs into the browser's persistent cache.
 * Call this when entering a Business Unit view to "warm up" all associated documents.
 */
export function usePreloadDocuments(buId: string | undefined, filenames: string[]) {
    useEffect(() => {
        if (!buId || filenames.length === 0) return;

        // Give priority to the UI thread, then start prefetching
        const timer = setTimeout(() => {
            filenames.forEach(filename => {
                const url = `/api/business-units/${buId}/files/${encodeURIComponent(filename)}`;

                // Use a hidden image or link to trigger browser cache population
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                link.as = 'document';
                document.head.appendChild(link);

                // Cleanup after a while or leave it to standard prefetch behavior
                setTimeout(() => {
                    if (document.head.contains(link)) {
                        document.head.removeChild(link);
                    }
                }, 10000);
            });
            console.log(`[Cache] Warming up ${filenames.length} documents for BU: ${buId}`);
        }, 2000); // Wait 2 seconds for initial UI to settle

        return () => clearTimeout(timer);
    }, [buId, filenames]);
}
