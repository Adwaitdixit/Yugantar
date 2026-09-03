import { useState, useEffect, useRef } from 'react';
import {
  X, Play, Pause, MapPin, Calendar, User, Globe, Shield, BookOpen,
  CheckCircle2, Sparkles, FileText, Users, Award, Eye, History, Info
} from 'lucide-react';
import { CATEGORY_CONFIG, VERIFICATION_CONFIG, CONSENT_CONFIG, type CulturalRecord, type ProvenanceEvent } from '../data/types';
import { evidenceRegistry } from '../data/seedData';
import { formatAudioDuration, formatPlaybackTime } from '../utils/audioDuration';
import './styles/RecordDetail.css';

interface RecordDetailProps {
  record: CulturalRecord;
  onClose: () => void;
}

const LIFECYCLE_STAGES_CONFIG: { stage: ProvenanceEvent['stage']; label: string; icon: any }[] = [
  { stage: 'contributed', label: 'Community Contribution', icon: User },
  { stage: 'ai_processing', label: 'AI Processing', icon: Sparkles },
  { stage: 'evidence_added', label: 'Evidence Added', icon: FileText },
  { stage: 'under_review', label: 'Community Review', icon: Users },
  { stage: 'verified', label: 'Verified', icon: Award },
  { stage: 'published', label: 'Published', icon: Eye },
];

export default function RecordDetail({ record, onClose }: RecordDetailProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [transcriptTab, setTranscriptTab] = useState<'original' | 'english'>('original');
  const [selectedTimelineStage, setSelectedTimelineStage] = useState<string | null>(null);
  const [waveBars, setWaveBars] = useState<number[]>([]);
  const animRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const currentStatus = record.lifecycleStatus || 'published';

  // Setup audio element if original audio url exists
  useEffect(() => {
    if (record.originalAudioUrl) {
      const audio = new Audio(record.originalAudioUrl);
      audio.ontimeupdate = () => setAudioCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlaying(false);
        setAudioCurrentTime(0);
      };
      audio.onerror = (e) => {
        console.warn('[RecordDetail] Audio playback error:', e);
        setIsPlaying(false);
      };
      audioElRef.current = audio;
    }
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    };
  }, [record.originalAudioUrl]);

  // Generate initial wave bars
  useEffect(() => {
    const bars = Array.from({ length: 50 }, () => Math.random() * 100);
    setWaveBars(bars);
  }, []);

  // Animate waveform when playing
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setWaveBars(prev => prev.map(b => Math.max(5, b + (Math.random() - 0.5) * 30)));
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  const togglePlay = () => {
    if (audioElRef.current) {
      if (isPlaying) {
        audioElRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => {
            console.warn('[RecordDetail] Playback error:', e);
            setIsPlaying(false);
          });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const getClaimIcon = (status: string) => {
    switch (status) {
      case 'supported': return '✅';
      case 'oral_tradition': return '📜';
      case 'unverified': return '❓';
      case 'conflicting': return '⚠️';
      default: return '❓';
    }
  };

  const getClaimEvidence = (evidenceIds: string[]) => {
    return evidenceIds.map(id => evidenceRegistry.find(e => e.id === id)).filter(Boolean);
  };

  const timeline = record.provenanceTimeline || [];
  const currentStageEvent = timeline.find(t => t.current) || timeline[timeline.length - 1];
  const activeTimelineItem = timeline.find(t => t.stage === selectedTimelineStage) || currentStageEvent;

  return (
    <div className="record-detail-overlay" onClick={onClose} id="record-detail-overlay">
      <div className="record-detail-modal" onClick={e => e.stopPropagation()} id="record-detail-modal">
        {/* Hero */}
        <div className="record-detail-hero" style={{
          background: `linear-gradient(135deg, ${CATEGORY_CONFIG[record.category].color}11, var(--ivory))`
        }}>
          <button className="close-btn" onClick={onClose} id="close-record-detail">
            <X size={18} />
          </button>

          <div className="record-detail-badges">
            {record.id.startsWith('ICH0') ? (
              <span className="badge" style={{ background: 'rgba(180, 85, 44, 0.15)', color: 'var(--terracotta)', fontWeight: 700, border: '1px solid var(--terracotta)' }}>
                🏛️ Institutional: IGNCA Inventory
              </span>
            ) : record.id.startsWith('ICH-') ? (
              <span className="badge" style={{ background: 'rgba(217, 164, 65, 0.2)', color: 'var(--turmeric-dark)', fontWeight: 700, border: '1px solid var(--turmeric)' }}>
                🌐 UNESCO Representative List
              </span>
            ) : (
              <span className="badge badge-terracotta">
                👥 Community Contribution ({record.id})
              </span>
            )}
            <span className="badge badge-terracotta">
              {CATEGORY_CONFIG[record.category].emoji} {CATEGORY_CONFIG[record.category].label}
            </span>
            <span className={`badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}`}>
              {VERIFICATION_CONFIG[record.verificationStatus].label}
            </span>
            <span className="badge" style={{ background: 'rgba(43, 58, 85, 0.1)', color: 'var(--indigo)' }}>
              {CONSENT_CONFIG[record.consentTier].icon} {CONSENT_CONFIG[record.consentTier].label}
            </span>
            <span className="badge" style={{
              background: currentStatus === 'published' ? 'rgba(107, 142, 111, 0.2)' : 'rgba(217, 164, 65, 0.2)',
              color: currentStatus === 'published' ? 'var(--sage-dark)' : 'var(--turmeric-dark)',
              fontWeight: 700,
              border: '1px solid currentColor'
            }}>
              Lifecycle: {currentStatus.replace('_', ' ').toUpperCase()}
            </span>
            {record.isEndangered && (
              <span className="badge badge-endangered">⚠ Endangered</span>
            )}
          </div>

          <h2 className="record-detail-title">{record.title}</h2>
          {record.nativeTitle && (
            <div className="record-detail-native">{record.nativeTitle}</div>
          )}

          <div className="record-detail-meta">
            <span className="meta-item"><MapPin size={14} /> {record.state}{record.district ? `, ${record.district}` : ''}</span>
            <span className="meta-item"><Globe size={14} /> {record.originalLanguage}{record.dialect ? ` (${record.dialect})` : ''}</span>
            <span className="meta-item"><Calendar size={14} /> {record.recordingDate}</span>
            <span className="meta-item"><User size={14} /> {record.contributor}</span>
          </div>
        </div>

        <div className="record-detail-body">
          {/* ============================================================
             VISUAL PROVENANCE & LIFECYCLE TIMELINE
             ============================================================ */}
          <div className="lifecycle-timeline-box" id="provenance-lifecycle-timeline">
            <div className="timeline-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'var(--terracotta)' }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--slate)', fontFamily: 'var(--font-display)' }}>
                  Cultural Record Provenance & Lifecycle Timeline
                </h4>
              </div>
              <span className="lifecycle-status-pill">
                Status: <strong>{currentStatus.replace('_', ' ').toUpperCase()}</strong>
              </span>
            </div>

            {/* Stepper Bar */}
            <div className="provenance-stepper">
              {LIFECYCLE_STAGES_CONFIG.map((cfg, idx) => {
                const event = timeline.find(e => e.stage === cfg.stage);
                const isCompleted = event ? event.completed : false;
                const isCurrent = event ? event.current || (!isCompleted && idx === 0) : false;
                const isSelected = selectedTimelineStage === cfg.stage;
                const IconComponent = cfg.icon;

                return (
                  <div
                    key={cfg.stage}
                    className={`stepper-node ${isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTimelineStage(cfg.stage)}
                    title={`${cfg.label}: ${event ? event.details : 'Pending stage'}`}
                  >
                    <div className="node-marker">
                      {isCompleted ? (
                        <CheckCircle2 size={15} className="node-check-icon" />
                      ) : isCurrent ? (
                        <span className="node-current-dot" />
                      ) : (
                        <span className="node-pending-dot" />
                      )}
                    </div>
                    <div className="node-label">
                      <IconComponent size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {cfg.label}
                    </div>
                    {idx < LIFECYCLE_STAGES_CONFIG.length - 1 && <div className={`stepper-line ${isCompleted ? 'line-active' : ''}`} />}
                  </div>
                );
              })}
            </div>

            {/* Selected Stage Detail Drawer */}
            {activeTimelineItem && (
              <div className="timeline-detail-drawer">
                <div className="drawer-top-row">
                  <div className="drawer-stage-badge">
                    <span>Milestone:</span> <strong>{activeTimelineItem.title}</strong>
                  </div>
                  <div className="drawer-actor-date">
                    <span>Actor: <strong>{activeTimelineItem.actor}</strong></span> · <span>Date: {activeTimelineItem.date}</span>
                  </div>
                </div>
                <p className="drawer-description">{activeTimelineItem.details}</p>
              </div>
            )}

            {/* Ethical Governance Notice */}
            <div className="ethical-governance-banner">
              <Info size={15} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <strong>Ethical Governance Rule:</strong> AI assisted processing and evidence identification; verification was performed through the appropriate human/community review process.
              </div>
            </div>
          </div>

          {/* Featured Heritage Photograph */}
          {record.images && record.images.length > 0 && (
            <div className="record-detail-image-box" style={{ marginBottom: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
              <img src={record.images[0]} alt={record.title} style={{ width: '100%', maxHeight: '380px', objectFit: 'cover' }} />
              {record.practiceNotes && (
                <div style={{ padding: '8px 14px', background: 'var(--ivory-warm)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  🏛️ {record.practiceNotes}
                </div>
              )}
            </div>
          )}

          {/* Preserved Original Audio Player */}
          {(record.originalAudioUrl || record.audioScript) && (
            <div className="audio-player-section" id="audio-player">
              <div className="audio-player-header">
                <h4>🎙️ Preserved Original Voice Recording</h4>
                <span className="tag" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--ivory)', borderColor: 'rgba(255,255,255,0.2)' }}>
                  {record.originalLanguage}
                </span>
              </div>
              <div className="audio-waveform">
                {waveBars.map((h, i) => (
                  <div
                    key={i}
                    className={`wave-bar ${isPlaying ? 'active' : ''}`}
                    style={{ height: `${Math.max(4, isPlaying ? h : h * 0.4)}%` }}
                  />
                ))}
              </div>
              <div className="audio-controls">
                <button className="play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play Preserved Audio'}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <span className="audio-time" style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.5px' }}>
                  {formatPlaybackTime(audioCurrentTime)} / {formatAudioDuration(record.audioDuration)}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Primary Cultural Source Audio</span>
              </div>
            </div>
          )}

          {/* Transcript */}
          {(record.transcriptOriginal || record.transcriptEnglish) && (
            <div className="transcript-section" id="transcript-section">
              <div className="section-label"><BookOpen size={18} /> Transcript</div>
              <div className="transcript-tabs">
                <button
                  className={`transcript-tab ${transcriptTab === 'original' ? 'active' : ''}`}
                  onClick={() => setTranscriptTab('original')}
                >
                  Original ({record.originalLanguage})
                </button>
                <button
                  className={`transcript-tab ${transcriptTab === 'english' ? 'active' : ''}`}
                  onClick={() => setTranscriptTab('english')}
                >
                  English Translation
                </button>
              </div>
              <div className={`transcript-content ${transcriptTab}`}>
                {transcriptTab === 'original'
                  ? record.transcriptOriginal || 'Original transcript not available'
                  : record.transcriptEnglish || 'English translation not available'}
              </div>
            </div>
          )}

          {/* Full Description */}
          <div className="section-label">📖 Full Description</div>
          <p className="full-description">{record.fullDescription}</p>

          {/* Provenance & Attribution Grid */}
          <div className="provenance-section" id="provenance-section">
            <div className="section-label"><Shield size={18} /> Provenance & Archival Attribution</div>
            <div className="provenance-grid">
              <div className="provenance-item">
                <div className="label">Cultural Record ID</div>
                <div className="value" style={{ fontWeight: 800, color: 'var(--terracotta)' }}>{record.id}</div>
              </div>
              <div className="provenance-item">
                <div className="label">Original Contributor</div>
                <div className="value">{record.contributor}</div>
              </div>
              {record.knowledgeHolder && (
                <div className="provenance-item">
                  <div className="label">Knowledge Holder</div>
                  <div className="value">{record.knowledgeHolder}</div>
                </div>
              )}
              {record.community && (
                <div className="provenance-item">
                  <div className="label">Community Custodian</div>
                  <div className="value">{record.community}</div>
                </div>
              )}
              {record.collector && (
                <div className="provenance-item">
                  <div className="label">Field Collector</div>
                  <div className="value">{record.collector}</div>
                </div>
              )}
              <div className="provenance-item">
                <div className="label">Recording Date</div>
                <div className="value">{record.recordingDate}</div>
              </div>
              {record.sourceReference && (
                <div className="provenance-item">
                  <div className="label">Source Reference</div>
                  <div className="value">{record.sourceReference}</div>
                </div>
              )}
              <div className="provenance-item">
                <div className="label">Consent Tier</div>
                <div className="value">{CONSENT_CONFIG[record.consentTier].icon} {CONSENT_CONFIG[record.consentTier].label}</div>
              </div>
              <div className="provenance-item">
                <div className="label">Lifecycle State</div>
                <div className="value" style={{ fontWeight: 700, color: 'var(--terracotta)' }}>
                  {currentStatus.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Claims & Verification */}
          {record.claims && record.claims.length > 0 && (
            <div className="claims-section" id="claims-section">
              <div className="section-label">🔍 Claim-Level Verification</div>
              {record.claims.map(claim => {
                const evidence = getClaimEvidence(claim.evidenceIds);
                return (
                  <div key={claim.id} className="claim-item">
                    <div className={`claim-status-icon ${claim.status}`}>
                      {getClaimIcon(claim.status)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="claim-text">{claim.text}</div>
                      {evidence.length > 0 && (
                        <div style={{ marginTop: '6px' }}>
                          {evidence.map(ev => ev && (
                            <span key={ev.id} className="tag" style={{ marginRight: '4px', marginTop: '4px' }}>
                              📄 {ev.sourceName} ({ev.authority})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${claim.status === 'supported' ? 'badge-verified' : claim.status === 'oral_tradition' ? 'badge-oral' : 'badge-unverified'}`}>
                      {claim.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
