const BASE_URL = '/api';

// Smart cache per business unit with invalidation
const buCache = new Map<string, { data: any; timestamp: number; version: number }>();
const CACHE_DURATION = 30000; // 30 seconds
let cacheVersion = 0;

function getCachedData<T>(key: string): T | null {
    const cached = buCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`📋 Cache hit for ${key} (v${cached.version})`);
        return cached.data as T;
    }
    return null;
}

function setCachedData<T>(key: string, data: T): void {
    buCache.set(key, { data, timestamp: Date.now(), version: cacheVersion });
}

function invalidateBuCache(buId: string): void {
    cacheVersion++;
    console.log(`🗑️ Invalidated cache for BU ${buId} (v${cacheVersion})`);
    // Remove all cached data for this BU
    for (const [key] of buCache.keys()) {
        if (key.includes(buId)) {
            buCache.delete(key);
        }
    }
}

async function requestWithRetry<T>(path: string, options?: RequestInit, maxRetries: number = 3): Promise<T> {
    // Check cache first for GET requests
    if (!options || options.method === 'GET' || !options.method) {
        const cached = getCachedData<T>(path);
        if (cached) {
            return cached;
        }
    }

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await request<T>(path, options);
            
            // Cache successful GET responses
            if (!options || options.method === 'GET' || !options.method) {
                setCachedData(path, result);
            }
            
            return result;
        } catch (error) {
            lastError = error as Error;
            
            // Don't retry on client errors (4xx)
            if (error instanceof Error && error.message.includes('4')) {
                throw error;
            }
            
            // If not the last attempt, wait with exponential backoff
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError!;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        // Try to extract detail from FastAPI error body
        let detail = response.statusText;
        try {
            const errBody = await response.json();
            detail = errBody?.detail || JSON.stringify(errBody) || detail;
        } catch { }
        throw new Error(`API Error ${response.status}: ${detail}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
}

export const businessUnitApi = {
    list: () => request<any[]>('/business-units/'),
    get: (id: string) => request<any>(`/business-units/${id}`),
    getFullData: (id: string) => request<any>(`/business-units/${id}/full-data`),
    create: (data: any) => {
        invalidateBuCache(data.id || 'new'); // Invalidate cache on create
        return request<any>('/business-units/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    delete: (id: string) => {
        invalidateBuCache(id); // Invalidate cache on delete
        return request<void>(`/business-units/${id}`, {
            method: 'DELETE',
        });
    },
    patch: (id: string, data: any) => {
        invalidateBuCache(id); // Invalidate cache on update
        return request<any>(`/business-units/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
    getStats: () => request<any>('/business-units/stats/unified'),
    // Helper to load optimized data
    loadOptimizedData: async (buId: string) => {
        console.log('📦 Loading optimized business data...');
        const fullData = await businessUnitApi.getFullData(buId);
        const { business_unit, facts, reconciliation, existing_im } = fullData;
        
        console.log('✅ Optimized load complete:', {
            bu: business_unit?.name,
            factsCount: facts?.length || 0,
            conflictsCount: reconciliation?.conflicts?.length || 0,
            hasExistingIM: !!existing_im
        });
        
        return { business_unit, facts, reconciliation, existing_im };
    }
};

export const intelligenceApi = {
    // Use raw fetch for file upload — the request() wrapper always sets Content-Type: application/json
    // which breaks multipart/form-data (FastAPI needs the browser to set boundary automatically)
    upload: async (buId: string, files: File[]) => {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        let lastError: Error;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(`${BASE_URL}/business-units/${buId}/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    let detail = response.statusText;
                    try {
                        const errBody = await response.json();
                        detail = errBody?.detail || JSON.stringify(errBody) || detail;
                    } catch { }
                    
                    // Don't retry on client errors
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(`Upload failed ${response.status}: ${detail}`);
                    }
                    
                    throw new Error(`Upload failed ${response.status}: ${detail}`);
                }

                return response.json();
            } catch (error) {
                lastError = error as Error;
                
                // If not the last attempt, wait
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        throw lastError!;
    },

    processDocuments: (buId: string, forceReprocess?: boolean, filename?: string) => {
        const queryParams = new URLSearchParams();
        if (forceReprocess) queryParams.append('force_reprocess', 'true');
        if (filename) queryParams.append('filename', filename);
        const queryString = queryParams.toString();

        return request<any>(`/business-units/${buId}/process${queryString ? `?${queryString}` : ''}`, {
            method: 'POST'
        });
    },

    getReconciliation: (buId: string) => request<any>(`/business-units/${buId}/reconciliation`),

    generateIM: (buId: string, reconciledState: object, forceRegenerate = false) =>
        requestWithRetry<{ data: { sections: unknown[]; sources: unknown[] } }>(
            `/business-units/${buId}/generate?force_regenerate=${forceRegenerate}`,
            { method: 'POST', body: JSON.stringify(reconciledState) }
        ),

    regenerateSection: (buId: string, sectionId: string, tone: string) =>
        request<any>(`/business-units/${buId}/regenerate-section?section_id=${sectionId}&tone=${tone}`, {
            method: 'POST',
        }),

    deleteDocument: (buId: string, docId: string) =>
        request<void>(`/business-units/${buId}/documents/${docId}`, {
            method: 'DELETE',
        }),

    /** Returns blob for file download. Use response.blob() then createObjectURL. */
    exportDownload: (data: object, format: 'docx' | 'pdf') =>
        fetch(`${BASE_URL}/business-units/export?format=${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),

    exportToDrive: (buId: string, data: object, format: 'docx' | 'pdf' | 'gdoc') =>
        requestWithRetry<{ drive_url: string; format: string }>(`/business-units/${buId}/export/drive?format=${format}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getFacts: (buId: string) => request<any[]>(`/business-units/${buId}/facts`),

    updateFact: (buId: string, factId: string, data: any) =>
        request<any>(`/business-units/${buId}/facts/${factId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    resolveConflicts: (buId: string, factIds: string[]) =>
        request<any>(`/business-units/${buId}/resolve-conflicts`, {
            method: 'POST',
            body: JSON.stringify({ fact_ids: factIds }),
        }),
    deleteIM: (buId: string) =>
        request<void>(`/business-units/${buId}/generate`, {
            method: 'DELETE',
        }),

    getExistingIM: (buId: string) =>
        request<{ message: string; data: unknown }>(`/business-units/${buId}/generate`),
};
