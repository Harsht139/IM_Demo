import { create } from 'zustand';
import type { BusinessUnit, BusinessUnitSummary, Notification, Step, IMSection, IMSource } from '../types';

interface AppState {
    // Data State
    businessUnits: BusinessUnitSummary[];
    activeBuId: string | null;
    selectedBu: BusinessUnit | null;
    imSections: IMSection[];
    imSources: IMSource[];

    // UI State
    currentStep: Step;
    notifications: Notification[];
    isCreateModalOpen: boolean;

    // Actions
    setBusinessUnits: (bus: BusinessUnitSummary[]) => void;
    setActiveBuId: (id: string | null) => void;
    setSelectedBu: (bu: BusinessUnit | null) => void;
    setImSections: (sections: IMSection[]) => void;
    setImSources: (sources: IMSource[]) => void;
    setCurrentStep: (step: Step) => void;
    setCreateModalOpen: (open: boolean) => void;

    // Notification Actions
    addNotification: (message: string, type?: 'success' | 'error') => void;
    removeNotification: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
    businessUnits: [],
    activeBuId: null,
    selectedBu: null,
    imSections: [],
    imSources: [],
    currentStep: 'dashboard',
    notifications: [],
    isCreateModalOpen: false,

    setBusinessUnits: (businessUnits) => set({ businessUnits }),
    setActiveBuId: (activeBuId) => set({ activeBuId }),
    setSelectedBu: (selectedBu) => set({ selectedBu }),
    setImSections: (imSections) => set({ imSections }),
    setImSources: (imSources) => set({ imSources }),
    setCurrentStep: (currentStep) => set({ currentStep }),
    setCreateModalOpen: (isCreateModalOpen) => set({ isCreateModalOpen }),

    addNotification: (message, type = 'success') => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
            notifications: [...state.notifications, { id, message, type }]
        }));
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id)
            }));
        }, 5000);
    },
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),
}));
