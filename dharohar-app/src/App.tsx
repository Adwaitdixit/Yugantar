import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import ExploreHome from './components/ExploreHome';
import CulturalMap from './components/CulturalMap';
import RecordDetail from './components/RecordDetail';
import ContributeStudio from './components/ContributeStudio';
import AIPipelineVisualizer from './components/AIPipelineVisualizer';
import VerificationWorkbench from './components/VerificationWorkbench';
import ReviewerConsole from './components/ReviewerConsole';
import AdminConsole from './components/AdminConsole';
import ProtectedRoute from './components/ProtectedRoute';
import HeritageLens from './components/HeritageLens/HeritageLens';
import AuthModal, { type AuthIntent } from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { CulturalRecord } from './data/types';
import { culturalRecords } from './data/seedData';
import { culturalStore } from './data/culturalStore';
import './index.css';

function AppContent() {
  const { user, isReviewer } = useAuth();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(2);
  const [selectedRecord, setSelectedRecord] = useState<CulturalRecord | null>(null);

  useEffect(() => {
    culturalStore.sanitizeForUser(user?.email, user?.id, isReviewer);
  }, [user, isReviewer]);

  // Auth modal management
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>('general');
  const [authCustomMessage, setAuthCustomMessage] = useState<string | undefined>(undefined);
  const [pendingRecordToView, setPendingRecordToView] = useState<CulturalRecord | null>(null);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  const handleOpenAuth = (intent: AuthIntent = 'general', customMsg?: string, navPath?: string) => {
    setAuthIntent(intent);
    setAuthCustomMessage(customMsg);
    if (navPath) setPendingNavPath(navPath);
    setIsAuthModalOpen(true);
  };

  const handleViewRecord = (record: CulturalRecord) => {
    if (!user) {
      setPendingRecordToView(record);
      handleOpenAuth(
        'view_data',
        `Sign in with your email to view complete living lore, oral transcripts, and archival data for "${record.title}".`
      );
      return;
    }
    setSelectedRecord(record);
  };

  const handleCloseRecord = () => {
    setSelectedRecord(null);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingRecordToView) {
      setSelectedRecord(pendingRecordToView);
      setPendingRecordToView(null);
    }
    if (pendingNavPath) {
      navigate(pendingNavPath);
      setPendingNavPath(null);
    }
  };

  const handleToggleConnectivity = () => {
    setIsOnline(prev => !prev);
  };

  const handleAddPending = () => {
    setPendingSyncCount(prev => prev + 1);
  };

  return (
    <div className="app" id="app-root">
      <Header
        isOnline={isOnline}
        onToggleConnectivity={handleToggleConnectivity}
        pendingSyncCount={pendingSyncCount}
        onOpenAuth={() => handleOpenAuth('general')}
      />

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <ExploreHome
                onViewRecord={handleViewRecord}
                onOpenAuth={(intent) => handleOpenAuth(intent, undefined, intent === 'record' ? '/contribute' : undefined)}
              />
            }
          />
          <Route path="/map" element={<CulturalMap onViewRecord={handleViewRecord} />} />
          <Route
            path="/contribute"
            element={
              <ContributeStudio
                isOnline={isOnline}
                onAddPending={handleAddPending}
                onRequireAuth={(intent) => handleOpenAuth(intent)}
              />
            }
          />
          <Route path="/ai-pipeline" element={<AIPipelineVisualizer />} />
          <Route path="/pipeline" element={<AIPipelineVisualizer />} />
          <Route path="/lens" element={<HeritageLens />} />
          <Route path="/heritage-lens" element={<HeritageLens />} />
          <Route
            path="/verification"
            element={
              <ProtectedRoute allowedRoles={['expert', 'admin']} onOpenAuth={handleOpenAuth}>
                <VerificationWorkbench />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer"
            element={
              <ProtectedRoute allowedRoles={['reviewer', 'expert', 'admin']} onOpenAuth={handleOpenAuth}>
                <ReviewerConsole />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']} onOpenAuth={handleOpenAuth}>
                <AdminConsole />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {selectedRecord && (
        <RecordDetail
          record={selectedRecord}
          onClose={handleCloseRecord}
        />
      )}

      {/* Email Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        intent={authIntent}
        customMessage={authCustomMessage}
      />

      {/* Stitch Institutional Footer */}
      <footer style={{
        background: '#05080E',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '64px 0 32px',
        color: '#FAF8F5',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            paddingBottom: '40px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Col 1: Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                <div>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700 }}>Dharohar Setu</span>
                  <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: '#E5C365' }}>धरोहर सेतु</span>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#B4BDD4', lineHeight: 1.6 }}>
                National Geocartographic Repository &amp; Living Cultural Knowledge Graph for Tangible &amp; Intangible Heritage.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(250,248,245,0.7)', marginTop: 8 }}>
                <span style={{ color: '#E06D44' }}>📍</span>
                20.5937° N, 78.9629° E · Bharat
              </div>
            </div>

            {/* Col 2: Institutional Partners */}
            <div>
              <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#E5C365', marginBottom: 12, fontWeight: 600 }}>Institutional Partners</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem', color: '#B4BDD4', lineHeight: 2 }}>
                <li>Indira Gandhi National Centre for the Arts</li>
                <li>Archaeological Survey of India (ASI)</li>
                <li>Ministry of Culture, GoI</li>
                <li>UNESCO ICH Cell</li>
                <li>Indigenous Folklorist Collectives</li>
              </ul>
            </div>

            {/* Col 3: Living Infrastructure */}
            <div>
              <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#E5C365', marginBottom: 12, fontWeight: 600 }}>Living Infrastructure</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: '#B4BDD4', lineHeight: 2.2 }}>
                {[
                  `${culturalRecords.length}+ Catalogued Traditions`,
                  '22 Scheduled Indic Languages',
                  'Offline-First Mesh Synchronized',
                  'Spatial Graph Vector Bindings',
                ].map((text) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2DD4BF', flexShrink: 0 }} />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Cultural Commons */}
            <div>
              <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#E5C365', marginBottom: 12, fontWeight: 600 }}>Cultural Commons</h4>
              <p style={{ fontSize: '0.78rem', color: '#B4BDD4', lineHeight: 1.6 }}>
                All records and geographical entries are released under ethical cultural commons protocols safeguarding indigenous intellectual property rights.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', color: '#E5C365', marginTop: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>
                PUBLIC KNOWLEDGE ARCHIVE
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 24, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', color: 'rgba(180,189,212,0.7)' }}>
            <p style={{ margin: 0, color: 'rgba(180,189,212,0.7)' }}>© 2026 Dharohar Setu · National Living Cultural Heritage Repository</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ color: '#E06D44', fontWeight: 600 }}>Preserve Unbroken Memory</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
