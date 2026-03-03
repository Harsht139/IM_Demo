export interface FileUpload {
    id: string;
    name: string;
    size: string;
    type: string;
    status: 'uploading' | 'success' | 'error';
    progress: number;
    file?: File;
    docType?: 'financial_model' | 'credit_summary' | 'sanction_letter' | 'other';
}

export interface Citation {
    source_file: string;
    context: string;
    page_number?: number;
    coordinates?: { x: number; y: number; w: number; h: number };
}

export interface Fact {
    metric: string;
    value: string;
    normalized_value?: string;
    numeric_value?: number;
    citation: Citation;
    period?: string;
    reasoning?: string;
}

export interface Conflict {
    id: string;
    metric: string;
    status: 'pending' | 'resolved';
    resolvedValue?: string;
    sources: {
        name: string;
        value: string;
        normalized_value?: string;
        context: string;
        isRecommended?: boolean;
        period?: string;
        reasoning?: string;
        fact_id?: string;
        page_number?: number;
        coordinates?: any;
    }[];
}

export interface ResolvedFact {
    metric: string;
    value: string;
    source: string;
}

export interface IMSection {
    id: string;
    title: string;
    content: string;
    citations?: { label: string; color: 'blue' | 'indigo' | 'amber' }[];
    section_sources?: number[];
}

export interface IMSource {
    number: number;
    label: string;
    value?: string;
    context: string;
    color: string;
    source_file?: string;
    page_number?: number;
    coordinates?: number[] | { x: number; y: number; w: number; h: number };
}

export interface SectionNote {
    sectionId: string;
    note: string;
    lastUpdated: string;
}

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface Document {
    id: string;
    name: string;
    storage_path: string;
    extraction_data: Fact[];
    reconciliation_data?: {
        facts: Fact[];
        conflicts: Conflict[];
    };
    status: 'uploaded' | 'processing' | 'processed' | 'indexed' | 'error';
    uploaded_at: string;
}

export interface GeneratedOutput {
    id: string;
    type: 'IM' | 'RISK_REPORT' | 'EXECUTIVE_SUMMARY';
    content: {
        sections: IMSection[];
        sources: IMSource[];
    };
    status: 'DRAFT' | 'FINAL';
    created_at: string;
    updated_at: string;
}

export interface BusinessUnit {
    id: string;
    name: string;
    industry?: string;
    description?: string;
    created_at: string;
    updated_at: string;
    documents: Document[];
    generated_outputs: GeneratedOutput[];
}

export interface BusinessUnitCreate {
    name: string;
    industry?: string;
    description?: string;
}

export interface BusinessUnitSummary {
    id: string;
    name: string;
    created_at: string;
    document_count: number;
    status: string;
}

export interface DashboardStats {
    total_projects: number;
    total_documents: number;
    total_sections_generated: number;
    active_engagements: number;
}

export type Step = 'dashboard' | 'bu_select' | 'upload' | 'processing' | 'reconciliation' | 'output_preview' | 'intelligence_search' | 'document_library' | 'intelligence_hub';

export interface Deal {
    id: string;
    name: string;
    status: 'DRAFT' | 'READY_FOR_REVIEW' | 'COMMITTEE_REVIEW' | 'APPROVED';
    deal_type: string;
    sector: string;
    capacity: string;
    counterparty: string;
    files: any[];
    created_at: string;
    im_sections: any[];
}

export interface DealCreate {
    name: string;
    deal_type: string;
    sector: string;
    capacity: string;
    counterparty: string;
}
