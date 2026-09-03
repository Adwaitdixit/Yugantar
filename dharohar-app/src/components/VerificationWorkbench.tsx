import { useState } from 'react';
import { Shield, Play, Pause, X, FileText, CheckCircle2 } from 'lucide-react';
import { useCulturalRecords, culturalStore } from '../data/culturalStore';
import { evidenceRegistry, trustedSources } from '../data/seedData';
import { VERIFICATION_CONFIG, CATEGORY_CONFIG, type CulturalRecord } from '../data/types';
import { useAuth } from '../contexts/AuthContext';
import './styles/VerificationWorkbench.css';

interface VerificationWorkbenchProps {
  onViewRecord?: (record: CulturalRecord) => void;
}

export default function VerificationWorkbench({ onViewRecord: _onViewRecord }: VerificationWorkbenchProps) {
  const { user } = useAuth();
  const allRecords = useCulturalRecords();
  const records = allRecords.filter(r => r.lifecycleStatus !== 'draft');
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  const [reviewerNote, setReviewerNote] = useState('');
  const [activeAudioPlaying, setActiveAudioPlaying] = useState(false);
  const [audioRef] = useState<HTMLAudioElement>(() => new Audio());

  const selectedRecord = records.find(r => r.id === selectedRecordId) || records[0];

  const getClaimIcon = (status: string) => {
    switch (status) {
      case 'supported': return '✅';
      case 'oral_tradition': return '📜';
      case 'unverified': return '❓';
      case 'conflicting': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'supported': return 'Source-Supported';
      case 'oral_tradition': return 'Oral Tradition';
      case 'unverified': return 'Unverified';
      case 'conflicting': return 'Disputed';
      default: return status;
    }
  };

  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    if (activeAudioPlaying) {
      audioRef.pause();
      setActiveAudioPlaying(false);
    } else {
      audioRef.src = url;
      audioRef.play().catch(e => console.warn('Audio play error:', e));
      setActiveAudioPlaying(true);
      audioRef.onended = () => setActiveAudioPlaying(false);
    }
  };

  const handleAction = (status: 'verified' | 'published' | 'rejected' | 'evidence_needed') => {
    if (!selectedRecord) return;
    const officerName = user?.email ? `Expert Verifier (${user.email})` : 'Verification Workbench Officer';
    culturalStore.transitionStatus(selectedRecord.id, status, officerName, reviewerNote);
    setReviewerNote('');
  };

  return (
    <div className="verification-page page-enter" id="verification-page">
      <div className="section-header" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="ornament">🔍</div>
        <h2>Provenance & Verification Workbench</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '8px auto 0' }}>
          Real-time verification queue. We evaluate who attested the lore, where it originated, attached audio preservation, and documentary evidence.
        </p>
      </div>

      {/* Verification Framework Badges */}
      <div className="framework-grid stagger" id="framework-grid">
        {Object.entries(VERIFICATION_CONFIG).map(([key, config]) => (
          <div key={key} className="framework-card animate-fade-in-up">
            <div className="icon">
              {key === 'source_supported' ? '✅' :
               key === 'community_verified' ? '👥' :
               key === 'oral_tradition' ? '📜' :
               key === 'unverified' ? '❓' : '⚠️'}
            </div>
            <h4>{config.label}</h4>
            <p>{config.description}</p>
          </div>
        ))}
      </div>

      {/* Real Queue Explorer */}
      <div className="verification-demo" id="verification-demo" style={{ marginTop: 'var(--space-2xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} /> National Cultural Record Verification Queue ({records.length} Records)
        </h3>

        {/* Record Selector Tabs */}
        <div className="demo-record-selector" style={{ overflowX: 'auto', paddingBottom: '6px' }}>
          {records.map(record => (
            <button
              key={record.id}
              className={`demo-record-btn ${selectedRecord?.id === record.id ? 'active' : ''}`}
              onClick={() => setSelectedRecordId(record.id)}
            >
              <span style={{ fontWeight: 700, color: 'var(--terracotta)', marginRight: '4px' }}>{record.id}</span>
              {CATEGORY_CONFIG[record.category].emoji} {record.title}
              <span className="badge" style={{
                fontSize: '0.62rem',
                marginLeft: '6px',
                background: record.lifecycleStatus === 'published' ? 'rgba(107, 142, 111, 0.2)' : 'rgba(217, 164, 65, 0.2)',
                color: record.lifecycleStatus === 'published' ? 'var(--sage-dark)' : 'var(--turmeric-dark)',
              }}>
                {record.lifecycleStatus?.toUpperCase() || 'PUBLISHED'}
              </span>
            </button>
          ))}
        </div>

        {selectedRecord && (
          <div style={{ marginTop: 'var(--space-lg)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', border: '1px solid var(--border-medium)' }}>
            {/* Record Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-light)', paddingBottom: 'var(--space-md)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--terracotta)', fontWeight: 800, fontSize: '0.95rem' }}>{selectedRecord.id}</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedRecord.title}</h3>
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📍 {selectedRecord.state}{selectedRecord.district ? `, ${selectedRecord.district}` : ''} · 🌐 {selectedRecord.originalLanguage} · 👤 {selectedRecord.contributor} · 📅 {selectedRecord.recordingDate}
                </div>
              </div>

              {/* Media Player */}
              {selectedRecord.originalAudioUrl && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handlePlayAudio(selectedRecord.originalAudioUrl)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {activeAudioPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {activeAudioPlaying ? 'Pause Voice' : '🎙️ Play Original Audio'}
                </button>
              )}
            </div>

            {/* Narrative / Context */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate)', marginBottom: '4px' }}>
                📖 Primary Narrative / Lore Description:
              </div>
              <p style={{
                fontSize: '0.9rem',
                lineHeight: 1.7,
                color: '#FAF8F5',
                background: 'linear-gradient(135deg, rgba(224, 109, 68, 0.18) 0%, rgba(180, 85, 44, 0.1) 100%)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(224, 109, 68, 0.45)',
                borderLeft: '4px solid #E06D44',
                margin: 0
              }}>
                {selectedRecord.fullDescription}
              </p>
            </div>

            {/* Claim Comparison Table */}
            {selectedRecord.claims && selectedRecord.claims.length > 0 ? (
              <div className="claim-comparison">
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate)', marginBottom: '8px' }}>
                  🔬 Atomic Cultural Claims & Archival Evidence:
                </div>
                {selectedRecord.claims.map(claim => {
                  const evidence = claim.evidenceIds
                    .map(id => evidenceRegistry.find(e => e.id === id))
                    .filter(Boolean);

                  return (
                    <div key={claim.id} className="claim-row">
                      <div className="claim-text-col">
                        <div className="label" style={{ color: 'var(--terracotta)' }}>Claim Statement</div>
                        <div>{claim.text}</div>
                        {claim.reviewerNote && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <em>AI Analysis Note: {claim.reviewerNote}</em>
                          </div>
                        )}
                      </div>

                      <div className="status-col">
                        <div className={`status-icon-large ${claim.status}`}>
                          {getClaimIcon(claim.status)}
                        </div>
                        <span className={`badge ${
                          claim.status === 'supported' ? 'badge-verified' :
                          claim.status === 'oral_tradition' ? 'badge-oral' :
                          claim.status === 'conflicting' ? 'badge-disputed' :
                          'badge-unverified'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {getStatusLabel(claim.status)}
                        </span>
                      </div>

                      <div className="claim-text-col">
                        <div className="label" style={{ color: 'var(--indigo)' }}>Archival Proof</div>
                        {evidence.length > 0 ? (
                          evidence.map(ev => ev && (
                            <div key={ev.id} style={{ marginBottom: '4px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>📄 {ev.sourceName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {ev.authority} · {ev.sourceType} {ev.reference ? `(${ev.reference})` : ''}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No documentary evidence — community/oral attestation
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'var(--ivory-warm)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No atomic claims extracted yet. Run through the AI Pipeline or review full narrative below.
              </div>
            )}

            {/* Reviewer Action Bar */}
            <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-light)' }}>
              <label className="label" style={{ fontWeight: 600 }}>Reviewer Verification Decision</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  className="input"
                  placeholder="Enter verification notes or rationale..."
                  value={reviewerNote}
                  onChange={e => setReviewerNote(e.target.value)}
                  style={{ fontSize: '0.85rem', flex: 1 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleAction('published')}
                  style={{ background: 'var(--sage)', borderColor: 'var(--sage)' }}
                >
                  <CheckCircle2 size={14} /> Verify & Publish to Atlas ({selectedRecord.id})
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleAction('evidence_needed')}
                >
                  <FileText size={14} /> Request Archival Proof
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleAction('rejected')}
                  style={{ color: 'var(--madder)' }}
                >
                  <X size={14} /> Reject Submission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trusted Source Registry */}
      <div className="sources-section" id="trusted-sources">
        <div className="section-header" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3>📚 Trusted Source Registry</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Curated authoritative sources used for evidence-based verification.
          </p>
        </div>

        <div className="sources-grid stagger">
          {trustedSources.map(source => (
            <div key={source.id} className="source-card animate-fade-in-up">
              <span className={`source-type ${source.sourceType}`}>
                {source.sourceType}
              </span>
              <h4>{source.name}</h4>
              <div className="authority">{source.authority}</div>
              <div className="relevant">📌 {source.relevantClaim}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
