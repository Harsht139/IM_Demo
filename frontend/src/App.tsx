import { useEffect, useState } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  User,
  ChevronRight,
  RefreshCcw,
  LayoutDashboard,
  Plus,
  Briefcase,
  Database,
  Zap,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types & Utils
import { cn } from './lib/utils';
import type { Fact, Conflict, BusinessUnitSummary, IMSection, IMSource } from './types';

// Store & API
import { useStore } from './store/useStore';
import { businessUnitApi, intelligenceApi } from './api';

// Components
import { NavItem } from './components/common/NavItem';

// Views
import { DashboardView } from './views/DashboardView';
import { ReconciliationView } from './views/ReconciliationView';
import { FinalPreviewView } from './views/FinalPreviewView';
import { DocumentLibraryView } from './views/DocumentLibraryView';
import { IntelligenceHubView } from './views/IntelligenceHubView';
import { DocumentViewerView } from './views/DocumentViewerView';
import { CreateBusinessUnitModal as CreateProjectModal } from './components/CreateProjectModal';
import { RenameBuModal } from './components/RenameBuModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { Trash2, Pencil, X } from 'lucide-react';

function ViewerPage() {
  const { buId, filename } = useParams<{ buId: string; filename: string }>();
  return <DocumentViewerView buId={buId || ''} filename={decodeURIComponent(filename || '')} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/viewer/:buId/view/:filename" element={<ViewerPage />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/';
  // Zustand Store
  const {
    businessUnits, setBusinessUnits,
    activeBuId, setActiveBuId,
    selectedBu, setSelectedBu,
    imSections, setImSections,
    imSources, setImSources,
    isCreateModalOpen, setCreateModalOpen,
    notifications, addNotification, removeNotification,
  } = useStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [renameBu, setRenameBu] = useState<BusinessUnitSummary | null>(null);
  const [deleteBu, setDeleteBu] = useState<BusinessUnitSummary | null>(null);

  // Sync activeBuId with URL if on a workspace route
  useEffect(() => {
    const match = location.pathname.match(/^\/workspace\/([^/]+)/);
    if (match) {
      const urlBuId = match[1];
      if (activeBuId !== urlBuId) {
        handleSelectBusinessUnit(urlBuId, false);
      }
    } else if (isDashboardRoute) {
      setActiveBuId(null);
      setSelectedBu(null);
    }
  }, [location.pathname]);

  const [stats, setStats] = useState({ total_projects: 0, total_documents: 0, total_sections_generated: 0, active_engagements: 0 });

  const fetchAppData = async () => {
    try {
      const [bus, statsData] = await Promise.all([
        businessUnitApi.list(),
        businessUnitApi.getStats(),
      ]);
      setBusinessUnits(bus);
      setStats(statsData);
    } catch (err) { console.error('Failed to fetch data', err); }
  };

  useEffect(() => { fetchAppData(); }, []);

  // --- Handlers ---

  const handleSelectBusinessUnit = async (buId: string, shouldNavigate = true) => {
    try {
      const bu = await businessUnitApi.get(buId);
      setSelectedBu(bu);
      setActiveBuId(buId);
      if (shouldNavigate) {
        navigate(`/workspace/${buId}/documents`);
      }
    } catch (err) {
      addNotification('Failed to load workspace', 'error');
      navigate('/dashboard');
    }
  };

  const handleCreateBusinessUnit = async (name: string, description: string) => {
    try {
      const newBu = await businessUnitApi.create({ name, description });
      addNotification(`Workspace "${name}" created.`);
      fetchAppData();
      handleSelectBusinessUnit(newBu.id);
      setCreateModalOpen(false);
    } catch (err) {
      addNotification('Failed to create workspace', 'error');
    }
  };

  const handleEditBusinessUnit = async (buId: string, newName: string) => {
    try {
      await businessUnitApi.patch(buId, { name: newName });
      addNotification(`Workspace renamed to "${newName}".`);
      fetchAppData();
      // Also update selectedBu if it's the one being edited
      if (activeBuId === buId && selectedBu) {
        setSelectedBu({ ...selectedBu, name: newName });
      }
    } catch (err) {
      addNotification('Rename failed', 'error');
    }
  };

  const handleDeleteBusinessUnit = async (buId: string) => {
    try {
      await businessUnitApi.delete(buId);
      addNotification('Workspace deleted.');
      fetchAppData();
      if (activeBuId === buId) {
        setSelectedBu(null);
        setActiveBuId(null);
        navigate('/');
      }
    } catch (err) {
      addNotification('Delete failed', 'error');
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (!activeBuId) return;
    try {
      await intelligenceApi.upload(activeBuId, files);
      addNotification(`Documents uploaded successfully.`);
      const updatedBu = await businessUnitApi.get(activeBuId);
      setSelectedBu(updatedBu);
    } catch (err) {
      addNotification('Upload failed', 'error');
    }
  };

  const handleProcessDocuments = async (forceReprocess: boolean = false, filename?: string) => {
    if (!activeBuId) return;
    setIsProcessing(true);

    try {
      await intelligenceApi.processDocuments(activeBuId, forceReprocess, filename);
      addNotification(`Documents processed and reconciled successfully.`);

      const updatedBu = await businessUnitApi.get(activeBuId);
      setSelectedBu(updatedBu);

      navigate(`/workspace/${activeBuId}/reconciliation`);

    } catch (err: any) {
      addNotification('Processing failed. Please check the backend logs.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!activeBuId) return;
    try {
      await intelligenceApi.deleteDocument(activeBuId, docId);
      addNotification('Document deleted.');
      // Refresh BU to get updated doc list
      handleSelectBusinessUnit(activeBuId);
    } catch (err) {
      addNotification('Failed to delete document', 'error');
    }
  };

  const [isGeneratingIM, setIsGeneratingIM] = useState(false);

  const handleGenerateIM = async (_reconResult: { facts: Fact[], conflicts: Conflict[] }, forceRegenerate: boolean = false) => {
    if (!activeBuId) return;
    setIsGeneratingIM(true);
    try {
      const reconciledState = await intelligenceApi.getReconciliation(activeBuId);
      const result = await intelligenceApi.generateIM(activeBuId, reconciledState, forceRegenerate);
      setImSections((result.data?.sections as IMSection[]) || []);
      setImSources((result.data?.sources as IMSource[]) || []);
      addNotification(forceRegenerate ? 'IM Draft synthesized.' : 'Loaded existing IM Draft.');
      navigate(`/workspace/${activeBuId}/preview`);
    } catch (err) {
      addNotification('Synthesis failed', 'error');
    } finally {
      setIsGeneratingIM(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFF] flex flex-col text-[#0F172A] font-sans selection:bg-blue-100 antialiased">
      {/* Top Enterprise Bar */}
      <header className="h-[60px] bg-white border-b border-slate-200/60 flex items-center justify-between px-8 z-40 sticky top-0">
        <div className="flex items-center gap-4">
          <img src="/adani-logo.png" alt="Adani" className="h-10 w-auto object-contain" />
          <div className="w-px h-7 bg-slate-200" />
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-none">PROFINANCE <span className="text-blue-600">NEXUS</span></span>
            <span className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-widest uppercase">Intelligent Deal Synthesis</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 pr-6 border-r border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Intelligence Powered by</span>
            <img
              src="/dataslush-logo.png"
              alt="DataSlush"
              className="h-7 w-auto opacity-100 transition-all cursor-pointer"
              onClick={() => window.open('https://dataslush.com', '_blank')}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200 shadow-sm transition-transform hover:scale-105 cursor-pointer">
              <User size={18} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="hidden lg:flex w-[260px] bg-[#F0F3F8] border-r border-slate-200/60 flex-col z-30">
          <div className="p-6 space-y-8 flex-1 overflow-y-auto">
            <div className="space-y-1">
              <NavItem
                icon={<LayoutDashboard size={18} />}
                label="Dashboard Overview"
                active={isDashboardRoute}
                onClick={() => navigate('/dashboard')}
              />
            </div>

            <div className="space-y-4">
              <div className="px-3 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Units</span>
                <button onClick={() => setCreateModalOpen(true)} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {businessUnits.map(bu => (
                  <div key={bu.id} className="group/bu relative">
                    <button
                      onClick={() => handleSelectBusinessUnit(bu.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                        activeBuId === bu.id
                          ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                          : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        activeBuId === bu.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400 group-hover:bg-slate-300"
                      )}>
                        <Briefcase size={14} />
                      </div>
                      <span className="text-sm font-bold truncate max-w-[140px]">{bu.name}</span>
                      {activeBuId === bu.id && (
                        <motion.div layoutId="active-pill" className="absolute left-[-2px] w-1 h-4 rounded-full bg-blue-600" />
                      )}
                    </button>

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/bu:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenameBu(bu); }}
                        className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteBu(bu); }}
                        className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedBu && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="px-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Intelligence</span>
                </div>
                <div className="space-y-1">
                  <NavItem
                    icon={<Database size={18} />}
                    label="Document Library"
                    active={location.pathname === `/workspace/${activeBuId}/documents`}
                    onClick={() => navigate(`/workspace/${activeBuId}/documents`)}
                  />
                  <NavItem
                    icon={<Zap size={18} />}
                    label="Data Reconciliation"
                    active={location.pathname === `/workspace/${activeBuId}/reconciliation`}
                    onClick={() => navigate(`/workspace/${activeBuId}/reconciliation`)}
                  />
                  <NavItem
                    icon={<Sparkles size={18} />}
                    label="Nexus Generator"
                    active={location.pathname === `/workspace/${activeBuId}/intelligence`}
                    onClick={() => navigate(`/workspace/${activeBuId}/intelligence`)}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12 min-h-full">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <DashboardView
                  key="dashboard"
                  stats={stats}
                  businessUnits={businessUnits}
                  onSelectBusinessUnit={(id) => handleSelectBusinessUnit(id)}
                  onCreateBusinessUnit={() => setCreateModalOpen(true)}
                  onDeleteBusinessUnit={handleDeleteBusinessUnit}
                  onEditBusinessUnit={handleEditBusinessUnit}
                />
              } />

              <Route path="/workspace/:buId/*" element={
                <div className="space-y-8">
                  {/* Workspace Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Workspace</span>
                        <ChevronRight size={10} className="text-slate-300" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{selectedBu?.name}</span>
                      </div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tight">{selectedBu?.name}</h1>
                    </div>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="h-10 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-white hover:text-slate-900 transition-all flex items-center gap-2"
                    >
                      <RefreshCcw size={14} /> Close Workspace
                    </button>
                  </div>

                  <Routes>
                    <Route path="documents" element={
                      <DocumentLibraryView
                        key="library"
                        buId={activeBuId || ''}
                        documents={selectedBu?.documents || []}
                        onUpload={handleFileUpload}
                        onGoToReconciliation={() => navigate(`/workspace/${activeBuId}/reconciliation`)}
                        onDeleteDocument={handleDeleteDocument}
                        onProcessDocuments={handleProcessDocuments}
                        isProcessing={isProcessing}
                      />
                    } />
                    <Route path="reconciliation" element={
                      <ReconciliationView
                        key="reconciliation"
                        buId={activeBuId || ''}
                        onResolve={async (resolvedFactIds) => {
                          if (activeBuId && resolvedFactIds.length > 0) {
                            try {
                              await intelligenceApi.resolveConflicts(activeBuId, resolvedFactIds);
                            } catch (error) {
                              console.error("Failed to persist resolutions:", error);
                            }
                          }
                          navigate(`/workspace/${activeBuId}/intelligence`);
                        }}
                      />
                    } />
                    <Route path="intelligence" element={
                      <IntelligenceHubView
                        key="hub"
                        buId={activeBuId || ''}
                        onAction={(action) => {
                          if (action === 'im') {
                            const facts = selectedBu?.documents.map(d => d.extraction_data || []).flat() || [];
                            handleGenerateIM({ facts, conflicts: [] }); // Conflicts are handled DB-side now
                          }
                        }}
                        isGenerating={isGeneratingIM}
                      />
                    } />
                    <Route path="preview" element={
                      <FinalPreviewView
                        key="preview"
                        buId={activeBuId || ''}
                        dealId="latest"
                        projectName={selectedBu?.name || ''}
                        sections={imSections}
                        sources={imSources}
                        projectStatus="DRAFT"
                        onUpdateSections={setImSections}
                        isGenerating={isGeneratingIM}
                        onDeleteIM={async () => {
                          if (activeBuId) {
                            await intelligenceApi.deleteIM(activeBuId);
                            addNotification('IM Draft deleted from database.');
                            navigate(`/workspace/${activeBuId}/intelligence`);
                          }
                        }}
                        onRegenerateAll={() => {
                          const facts = selectedBu?.documents.map(d => d.extraction_data || []).flat() || [];
                          handleGenerateIM({ facts, conflicts: [] }, true);
                        }}
                      />
                    } />
                    <Route path="*" element={<Navigate to="documents" replace />} />
                  </Routes>
                </div>
              } />
            </Routes>
          </div>
        </main>
      </div>

      {/* Global Notifications */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] bg-white border border-slate-100'
              )}
            >
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', n.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>
                <Zap size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 leading-tight">{n.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeNotification(n.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreateBusinessUnit} />

      <RenameBuModal
        isOpen={!!renameBu}
        initialName={renameBu?.name || ''}
        isRenaming={isProcessing}
        onClose={() => setRenameBu(null)}
        onConfirm={async (newName) => {
          if (!renameBu) return;
          setIsProcessing(true);
          try {
            await handleEditBusinessUnit(renameBu.id, newName);
            setRenameBu(null);
          } finally {
            setIsProcessing(false);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteBu}
        documentName={deleteBu?.name || ''}
        isDeleting={isProcessing}
        onClose={() => setDeleteBu(null)}
        onConfirm={async () => {
          if (!deleteBu) return;
          setIsProcessing(true);
          try {
            await handleDeleteBusinessUnit(deleteBu.id);
            setDeleteBu(null);
          } finally {
            setIsProcessing(false);
          }
        }}
      />
    </div>
  );
}
