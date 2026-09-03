import { useState } from 'react';
import {
  X, MessageCircle, BookOpen, FileText, ExternalLink,
  Sparkles, Plus, CheckCircle2, Play, Pause
} from 'lucide-react';
import { useCulturalRecords, culturalStore } from '../data/culturalStore';
import { evidenceRegistry } from '../data/seedData';
import { CATEGORY_CONFIG, VERIFICATION_CONFIG, type LifecycleStatus, type ClaimStatus, type Evidence } from '../data/types';
import { useAuth } from '../contexts/AuthContext';
import { addContributionReview } from '../services/supabaseClient';
import './styles/ReviewerConsole.css';

interface ActionLog {
  id: string;
  recordTitle: string;
  action: string;
  icon: string;
  color: string;
  timestamp: string;
}

export default function ReviewerConsole() {
  const { user, role } = useAuth();
  const allRecords = useCulturalRecords();
  // Privacy & Authorization: Reviewers only see submitted, under-review, verified, or published traditions, never other users' drafts
  const records = allRecords.filter(r => r.lifecycleStatus !== 'draft');
  const [selectedId, setSelectedId] = useState<string>(records[0]?.id || '');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleStatus | 'all'>('all');
  const [reviewTab, setReviewTab] = useState<'media' | 'claims' | 'evidence' | 'lifecycle'>('media');
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  
  // Audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRef] = useState<HTMLAudioElement>(() => new Audio());

  // New evidence form state
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [newEvTitle, setNewEvTitle] = useState('');
  const [newEvSourceType, setNewEvSourceType] = useState<Evidence['sourceType']>('academic');
  const [newEvAuthority, setNewEvAuthority] = useState('');
  const [newEvRef, setNewEvRef] = useState('');
  const [newEvSupportClaim, setNewEvSupportClaim] = useState('');

  const filteredRecords = records.filter(r => {
    if (lifecycleFilter === 'all') return true;
    return (r.lifecycleStatus || 'published') === lifecycleFilter;
  });

  const selected = records.find(r => r.id === selectedId) || filteredRecords[0] || records[0];
  const selectedStatus = selected?.lifecycleStatus || 'published';

  // Toggle audio preview
  const handleToggleAudio = (url?: string) => {
    if (!url) return;
    if (isPlayingAudio) {
      audioRef.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.src = url;
      audioRef.play().catch(e => console.warn('Audio play error:', e));
      setIsPlayingAudio(true);
      audioRef.onended = () => setIsPlayingAudio(false);
    }
  };

  // Lifecycle status transition handler using central store & Supabase RLS
  const handleTransitionLifecycle = (newStatus: LifecycleStatus, actionLabel: string, icon: string, color: string) => {
    if (!selected) return;

    const reviewerName = user?.email ? `Reviewer (${user.email})` : 'Community Reviewer Council';
    culturalStore.transitionStatus(selected.id, newStatus, reviewerName, reviewNote);

    // Save confidential review to Supabase contribution_reviews table (RLS protected)
    addContributionReview(selected.id, newStatus, reviewNote || actionLabel, reviewerName, user?.id).catch(err => {
      console.warn('[ReviewerConsole] Error saving review record to Supabase:', err);
    });

    setActionLogs(prev => [{
      id: `LOG-${Date.now()}`,
      recordTitle: selected.title,
      action: `${actionLabel} ➔ ${newStatus.toUpperCase()}`,
      icon,
      color,
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
    setReviewNote('');
  };

  // Claim status update handler using central store
  const handleUpdateClaimStatus = (claimId: string, newStatus: ClaimStatus) => {
    if (!selected) return;
    culturalStore.updateClaimStatus(selected.id, claimId, newStatus);

    setActionLogs(prev => [{
      id: `LOG-${Date.now()}`,
      recordTitle: selected.title,
      action: `Updated Claim #${claimId} to ${newStatus.toUpperCase()}`,
      icon: '🔍',
      color: 'var(--indigo)',
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
  };

  // Attach evidence handler using central store
  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvTitle.trim() || !selected) return;

    const newEvId = `EV-REV-${Date.now().toString().slice(-4)}`;
    const newEv: Evidence = {
      id: newEvId,
      sourceName: newEvTitle,
      sourceType: newEvSourceType,
      authority: newEvAuthority || 'Independent Reviewer Document',
      reference: newEvRef || 'Submitted via Reviewer Console',
      date: new Date().getFullYear().toString(),
      supportsClaim: newEvSupportClaim || selected.claims?.[0]?.id || 'General Provenance',
    };

    culturalStore.attachEvidence(selected.id, newEv);

    setShowEvidenceForm(false);
    setNewEvTitle('');
    setNewEvAuthority('');
    setNewEvRef('');
    setActionLogs(prev => [{
      id: `LOG-${Date.now()}`,
      recordTitle: selected.title,
      action: `Attached New Evidence: "${newEvTitle}"`,
      icon: '📄',
      color: 'var(--sage)',
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
  };

  return (
    <div className="reviewer-page page-enter" id="reviewer-page">
      <div className="section-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="ornament">📋</div>
        <h2>Community Reviewer & Provenance Console</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '650px', margin: '8px auto 0' }}>
          Evaluate cultural contributions, moderate extracted claims, link documentary evidence, and advance lifecycle stages from contribution to verified publication.
        </p>
        {user && (
          <div style={{ marginTop: '10px' }}>
            <span className="badge badge-gold" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
              Authorized Reviewer Session: {user.email} [{role.toUpperCase()}]
            </span>
          </div>
        )}
      </div>

      <div className="reviewer-layout">
        {/* Queue Panel */}
        <div className="queue-panel" id="review-queue">
          <div className="queue-header">
            <h3>Lifecycle Review Queue</h3>
            <span className="queue-count">{filteredRecords.length}</span>
          </div>

          {/* Lifecycle Filter Chips */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['all', 'contributed', 'synced', 'ai_processing', 'evidence_needed', 'under_review', 'verified', 'published', 'rejected'] as const).map(st => (
              <button
                key={st}
                onClick={() => setLifecycleFilter(st)}
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-round)',
                  border: '1px solid',
                  borderColor: lifecycleFilter === st ? 'var(--terracotta)' : 'var(--border-light)',
                  background: lifecycleFilter === st ? 'var(--terracotta)' : 'var(--bg-card)',
                  color: lifecycleFilter === st ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {st === 'all' ? 'All Stages' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="queue-list">
            {filteredRecords.map(record => {
              const status = record.lifecycleStatus || 'published';
              return (
                <div
                  key={record.id}
                  className={`queue-record ${selected?.id === record.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(record.id)}
                >
                  <span className="emoji">{CATEGORY_CONFIG[record.category].emoji}</span>
                  <div className="info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--terracotta)' }}>{record.id}</span>
                      <h4>{record.title}</h4>
                    </div>
                    <p>{record.state} · {record.originalLanguage}</p>
                    <div className="badges" style={{ gap: '4px', marginTop: '4px' }}>
                      <span className="badge" style={{
                        fontSize: '0.6rem',
                        padding: '2px 6px',
                        background: status === 'published' ? 'rgba(107, 142, 111, 0.15)' : 'rgba(217, 164, 65, 0.15)',
                        color: status === 'published' ? 'var(--sage-dark)' : 'var(--turmeric-dark)',
                        fontWeight: 700,
                      }}>
                        {status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}`} style={{ fontSize: '0.58rem', padding: '2px 6px' }}>
                        {VERIFICATION_CONFIG[record.verificationStatus].label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Panel */}
        {selected && (
          <div className="review-panel" id="review-panel">
            <div className="review-panel-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--terracotta)', fontWeight: 800 }}>{selected.id}</span>
                  <h3 style={{ margin: 0 }}>{CATEGORY_CONFIG[selected.category].emoji} {selected.title}</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Submitted by <strong>{selected.contributor}</strong> · Recorded: {selected.recordingDate}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="badge" style={{
                  background: selectedStatus === 'published' ? 'var(--sage)' : 'var(--terracotta)',
                  color: 'white',
                  fontWeight: 700,
                }}>
                  Lifecycle: {selectedStatus.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Review Tabs */}
            <div className="review-tabs">
              <button className={`review-tab ${reviewTab === 'media' ? 'active' : ''}`} onClick={() => setReviewTab('media')}>
                🎙️ Media & Context
              </button>
              <button className={`review-tab ${reviewTab === 'claims' ? 'active' : ''}`} onClick={() => setReviewTab('claims')}>
                🔬 Claims ({selected.claims?.length || 0})
              </button>
              <button className={`review-tab ${reviewTab === 'evidence' ? 'active' : ''}`} onClick={() => setReviewTab('evidence')}>
                📚 Evidence
              </button>
              <button className={`review-tab ${reviewTab === 'lifecycle' ? 'active' : ''}`} onClick={() => setReviewTab('lifecycle')}>
                ⏳ Provenance Timeline
              </button>
            </div>

            <div className="review-content">
              {/* Media & Context Tab */}
              {reviewTab === 'media' && (
                <div>
                  {selected.originalAudioUrl ? (
                    <div className="media-preview" style={{ marginBottom: 'var(--space-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>🎙️ Preserved Original Audio Recording</h4>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleToggleAudio(selected.originalAudioUrl)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          {isPlayingAudio ? <Pause size={14} /> : <Play size={14} />}
                          {isPlayingAudio ? 'Pause Voice' : 'Play Original Audio'}
                        </button>
                      </div>
                      <div className="media-waveform" style={{ marginTop: '8px' }}>
                        {Array.from({ length: 60 }, (_, i) => (
                          <div key={i} className="bar" style={{ height: `${10 + Math.random() * 90}%` }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>
                        {selected.originalLanguage}{selected.dialect ? ` · ${selected.dialect}` : ''}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                      <BookOpen size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Primary Narrative / Lore Description
                    </h4>
                    <div style={{
                      padding: 'var(--space-md) var(--space-lg)',
                      background: 'linear-gradient(135deg, rgba(224, 109, 68, 0.18) 0%, rgba(180, 85, 44, 0.1) 100%)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(224, 109, 68, 0.45)',
                      borderLeft: '4px solid #E06D44',
                      fontSize: '0.92rem',
                      lineHeight: 1.7,
                      color: '#FAF8F5',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                    }}>
                      {selected.fullDescription}
                    </div>
                  </div>

                  {selected.aiAssistedFields && (
                    <div style={{
                      padding: 'var(--space-md)',
                      background: 'rgba(43, 58, 85, 0.04)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(43, 58, 85, 0.15)',
                      marginBottom: 'var(--space-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--indigo)', fontWeight: 700, fontSize: '0.84rem', marginBottom: '6px' }}>
                        <Sparkles size={14} /> AI Assisted Analysis ({selected.aiAssistedFields.modelUsed || 'Gemini 3.5'})
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {selected.aiAssistedFields.summary}
                      </p>
                      {selected.aiAssistedFields.extractedEntities && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {selected.aiAssistedFields.extractedEntities.map((ent, idx) => (
                            <span key={idx} className="tag" style={{ fontSize: '0.7rem' }}>🏷️ {ent}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Claims Tab with 1-Click Status Controls */}
              {reviewTab === 'claims' && (
                <div className="claims-review">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Review each extracted claim individually. Gemini AI extraction does not certify truth.
                    </span>
                  </div>

                  {selected.claims && selected.claims.length > 0 ? (
                    selected.claims.map(claim => {
                      const evidence = claim.evidenceIds
                        .map(id => evidenceRegistry.find(e => e.id === id))
                        .filter(Boolean);

                      return (
                        <div key={claim.id} className="claim-review-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ fontSize: '1.3rem' }}>
                              {claim.status === 'supported' ? '✅' :
                               claim.status === 'oral_tradition' ? '📜' :
                               claim.status === 'conflicting' ? '⚠️' : '❓'}
                            </div>
                            <div className="claim-body" style={{ flex: 1 }}>
                              <h5>{claim.text}</h5>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Claim Status:</span>
                                <select
                                  value={claim.status}
                                  onChange={e => handleUpdateClaimStatus(claim.id, e.target.value as ClaimStatus)}
                                  style={{
                                    fontSize: '0.76rem',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1.5px solid var(--border-medium)',
                                    background: 'var(--bg-card)',
                                    fontWeight: 600,
                                  }}
                                >
                                  <option value="supported">✅ Source-supported</option>
                                  <option value="oral_tradition">📜 Oral-tradition</option>
                                  <option value="unverified">❓ Unverified</option>
                                  <option value="conflicting">⚠️ Conflicting / Disputed</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {evidence.length > 0 && (
                            <div style={{ marginTop: '8px', paddingLeft: '36px' }}>
                              {evidence.map(ev => ev && (
                                <div key={ev.id} className="evidence-link">
                                  <ExternalLink size={12} /> {ev.sourceName} ({ev.authority})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                      No claims extracted for this record yet. Process in AI Pipeline to generate structured claims.
                    </p>
                  )}
                </div>
              )}

              {/* Evidence Tab with Add Evidence Form */}
              {reviewTab === 'evidence' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '0.9rem', margin: 0 }}>Attached Documentary Proof</h4>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowEvidenceForm(!showEvidenceForm)}
                    >
                      <Plus size={14} /> Attach New Evidence
                    </button>
                  </div>

                  {showEvidenceForm && (
                    <form onSubmit={handleAddEvidence} style={{
                      padding: 'var(--space-md)',
                      background: 'var(--ivory-warm)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-md)',
                    }}>
                      <h5 style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>Attach Supporting Document / Archive</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input
                          className="input"
                          placeholder="Source / Archive Name (e.g. Sangeet Natak Akademi)"
                          value={newEvTitle}
                          onChange={e => setNewEvTitle(e.target.value)}
                          required
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                        <input
                          className="input"
                          placeholder="Author / Institution (e.g. Ministry of Culture)"
                          value={newEvAuthority}
                          onChange={e => setNewEvAuthority(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <select
                          className="input"
                          value={newEvSourceType}
                          onChange={e => setNewEvSourceType(e.target.value as Evidence['sourceType'])}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        >
                          <option value="government">🏛️ Government Source</option>
                          <option value="archival">📜 Archival Source</option>
                          <option value="academic">🎓 Academic Source</option>
                          <option value="community">👥 Community Attestation</option>
                        </select>
                        <input
                          className="input"
                          placeholder="Supports Claim ID / Description"
                          value={newEvSupportClaim}
                          onChange={e => setNewEvSupportClaim(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        />
                      </div>
                      <input
                        className="input"
                        placeholder="Reference URL or Publication Citation"
                        value={newEvRef}
                        onChange={e => setNewEvRef(e.target.value)}
                        style={{ fontSize: '0.82rem', padding: '6px 10px', width: '100%', marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowEvidenceForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary">
                          Attach Proof
                        </button>
                      </div>
                    </form>
                  )}

                  {selected.claims && selected.claims.flatMap(c => c.evidenceIds).length > 0 ? (
                    <div className="claims-review">
                      {selected.claims.flatMap(c => c.evidenceIds).map(evId => {
                        const ev = evidenceRegistry.find(e => e.id === evId);
                        if (!ev) return null;
                        return (
                          <div key={ev.id} className="claim-review-item">
                            <div style={{ fontSize: '1.3rem' }}>📄</div>
                            <div className="claim-body">
                              <h5>{ev.sourceName}</h5>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {ev.authority} · {ev.sourceType} · {ev.date || 'Date unknown'}
                              </p>
                              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                                <strong>Supports:</strong> {ev.supportsClaim}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Ref: {ev.reference}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-xl)', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ color: 'var(--text-muted)', margin: '0 0 8px' }}>
                        No documentary evidence linked yet. This record relies solely on oral testimony.
                      </p>
                      <button className="btn btn-sm btn-secondary" onClick={() => setShowEvidenceForm(true)}>
                        <Plus size={14} /> Link Archival Evidence
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Lifecycle Provenance Timeline Tab */}
              {reviewTab === 'lifecycle' && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>Milestone History</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selected.provenanceTimeline?.map((evt, idx) => (
                      <div key={idx} style={{
                        padding: '10px 14px',
                        background: evt.completed ? 'rgba(224, 109, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: evt.completed ? '1px solid rgba(224, 109, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-md)',
                        opacity: evt.completed ? 1 : 0.6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
                          <span style={{ color: 'var(--slate)' }}>{evt.title}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{evt.date}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          {evt.details} (Actor: {evt.actor})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes */}
              <div className="review-notes">
                <label className="label" style={{ marginTop: 'var(--space-lg)', fontWeight: 600 }}>
                  Reviewer Verdict Notes
                </label>
                <textarea
                  className="textarea"
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Document verification rationale, requested evidence, or rejection reasons..."
                  style={{ minHeight: '65px' }}
                />
              </div>

              {/* Real Lifecycle Action Buttons */}
              <div className="review-actions">
                <button
                  className="review-action-btn approve"
                  onClick={() => handleTransitionLifecycle('published', 'Approved & Published', '🌐', 'var(--sage)')}
                  title="Verify and publish record to the public Cultural Atlas and Heritage Map"
                >
                  <CheckCircle2 size={16} /> Verify & Publish ({selected.id})
                </button>

                <button
                  className="review-action-btn oral"
                  onClick={() => handleTransitionLifecycle('evidence_needed', 'Requested Additional Evidence', '📄', 'var(--turmeric)')}
                  title="Mark that additional archival proof is needed"
                >
                  <FileText size={16} /> Request Evidence
                </button>

                <button
                  className="review-action-btn clarify"
                  onClick={() => handleTransitionLifecycle('under_review', 'Set Under Active Review', '👥', 'var(--indigo)')}
                  title="Assign for peer community review"
                >
                  <MessageCircle size={16} /> Under Review
                </button>

                <button
                  className="review-action-btn reject"
                  onClick={() => handleTransitionLifecycle('rejected', 'Rejected Record', '❌', 'var(--madder)')}
                  title="Reject submission due to conflicting commercial or fraudulent claims"
                >
                  <X size={16} /> Reject Submission
                </button>
              </div>

              {/* Action Log */}
              {actionLogs.length > 0 && (
                <div className="action-log">
                  <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>Console Activity Log</h4>
                  {actionLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="log-item">
                      <div className="log-icon" style={{ background: `${log.color}22`, fontSize: '0.9rem' }}>
                        {log.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{log.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}> — {log.recordTitle}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
