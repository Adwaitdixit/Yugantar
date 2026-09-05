import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Cpu, Globe, FileText, ArrowRight, RefreshCw, ArrowDown, Download, MapPin, ChevronDown, List, Key, Play, Check } from 'lucide-react';
import { processCulturalTextWithGemini } from '../services/geminiService';
import type { GeminiCulturalAnalysis } from '../data/types';
import { culturalStore } from '../data/culturalStore';
import { useTranslation } from '../contexts/I18nContext';
import './styles/AIPipeline.css';

interface PipelineStage {
  id: number;
  shortTitle: string;
  icon: string;
  title: string;
  description: string;
}

const STAGES: PipelineStage[] = [
  { id: 1, shortTitle: 'CAPTURE', icon: '🎙️', title: 'Community Voice Capture', description: 'Raw oral testimony from local community members.' },
  { id: 2, shortTitle: 'UNDERSTAND', icon: '🌐', title: 'Speech-to-Text & Language', description: 'Transcribing and detecting regional dialect.' },
  { id: 3, shortTitle: 'EXTRACT', icon: '📍', title: 'Cultural Extraction', description: 'Identifying people, practices, and places.' },
  { id: 4, shortTitle: 'ENRICH', icon: '📚', title: 'Contextual Enrichment', description: 'Connecting with regional metadata.' },
  { id: 5, shortTitle: 'ANALYZE', icon: '🧠', title: 'Claim Analysis', description: 'Organizing into discrete factual claims.' },
  { id: 6, shortTitle: 'VERIFY', icon: '🛡️', title: 'Provenance Verification', description: 'Determining evidence requirements.' },
  { id: 7, shortTitle: 'PRESERVE', icon: '🏛️', title: 'Digital Preservation', description: 'Generating structured archival record.' }
];

const SAMPLE_INPUT = `This ancient temple in Hampi was built in 1336 by King Harihara I of the Vijayanagara Empire. The temple's gopuram rises to 50 meters and features intricate carvings depicting scenes from the Ramayana. Local priests perform a unique fire ritual every full moon that has been practiced for over 700 years. The temple bell, weighing 2 tonnes, was cast from a single piece of bronze brought from Sri Lanka.`;

const PRESET_SAMPLES = [
  { label: '🏛️ Hampi Vijayanagara', text: SAMPLE_INPUT },
  { label: '💃 Kalbelia Folk Dance', text: `Kalbelia is a traditional folk dance of the Kalbelia community of Rajasthan. The dancers wear swirling black skirts with glass beads mimicking a cobra's movement, accompanied by the poongi wind instrument. Songs pass down desert folklore and snake charming traditions orally.` },
  { label: '🧵 Patan Patola Silk', text: `Patan Patola is an ancient double-ikat silk weaving craft from Patan, Gujarat, practiced by the Salvi community since the 12th century Solanki era. Both warp and weft threads are tie-dyed before weaving so geometric patterns appear identical on both sides.` },
];

export default function AIPipelineVisualizer() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [inputText, setInputText] = useState(SAMPLE_INPUT);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedStageId, setSelectedStageId] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<GeminiCulturalAnalysis | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(true);

  const runPipeline = async () => {
    if (!inputText.trim() || isProcessing) return;
    setIsProcessing(true);
    setApiError(null);
    setActiveStep(1);
    setSelectedStageId(1);
    setCompletedSteps(new Set());
    setAnalysisResult(null);
    setSourceExpanded(false); // Collapse source on run

    try {
      const result = await processCulturalTextWithGemini(inputText);
      if (!result.success || !result.data) throw new Error(result.error || 'Gemini pipeline failed.');
      
      setAnalysisResult(result.data);
      if (selectedRecordId) {
        culturalStore.updateAiAnalysis(selectedRecordId, result.data);
      }

      const totalSteps = 7;
      let current = 1;
      const timer = setInterval(() => {
        current++;
        setCompletedSteps(prev => new Set([...prev, current - 1]));
        setActiveStep(current);
        setSelectedStageId(current);

        if (current >= totalSteps) {
          setCompletedSteps(prev => new Set([...prev, totalSteps]));
          clearInterval(timer);
          setIsProcessing(false);
        }
      }, 800);
    } catch (err: any) {
      setIsProcessing(false);
      setApiError(err.message || 'Processing encountered an error.');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'source-supported': return 'badge-verified';
      case 'community-verified': return 'badge-terracotta';
      case 'oral-tradition': return 'badge-oral';
      case 'conflicting': return 'badge-endangered';
      default: return 'badge-unverified';
    }
  };

  // -------------------------------------------------------------
  // STAGE RENDERERS
  // -------------------------------------------------------------
  
  const renderStageContent = () => {
    const isStageReady = completedSteps.has(selectedStageId) || (activeStep === selectedStageId && !isProcessing);
    const data = analysisResult;

    if (!data && selectedStageId > 1 && !isProcessing) {
      return (
        <div className="stage-empty-state">
          <RefreshCw size={24} style={{ opacity: 0.5, marginBottom: '12px' }} />
          <p>Awaiting pipeline execution.</p>
        </div>
      );
    }

    if (!isStageReady && isProcessing && activeStep < selectedStageId) {
        return (
          <div className="stage-empty-state">
            <RefreshCw size={24} className="spin" style={{ color: 'var(--sage)', marginBottom: '12px' }} />
            <p>Awaiting previous stages...</p>
          </div>
        );
    }

    if (activeStep === selectedStageId && isProcessing) {
      return (
        <div className="stage-empty-state processing">
          <RefreshCw size={32} className="spin" style={{ color: 'var(--turmeric)' }} />
          <p style={{ marginTop: '16px', color: 'var(--turmeric)' }}>Processing Stage {selectedStageId}...</p>
        </div>
      );
    }

    switch (selectedStageId) {
      case 1:
        return (
          <div className="horizontal-io-flow">
            <div className="io-column">
              <div className="io-label">INPUT</div>
              <div className="io-box">
                <FileText size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <strong>Voice/Text</strong>
                <span className="io-subtext">Community narrative</span>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">AI PROCESS</div>
              <div className="io-process">
                <span>Audio Transcription</span>
                <span>Text Sanitization</span>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">OUTPUT</div>
              <div className="io-box success">
                <FileText size={20} style={{ color: 'var(--sage)', marginBottom: '8px' }} />
                <strong>Testimony Record</strong>
                <span className="io-subtext">Clean text payload</span>
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="horizontal-io-flow">
            <div className="io-column">
              <div className="io-label">INPUT</div>
              <div className="io-box">
                <FileText size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <strong>Testimony Record</strong>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">AI PROCESS</div>
              <div className="io-process">
                <span>Language Detection</span>
                <span>Dialect Analysis</span>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">OUTPUT</div>
              <div className="io-box success">
                <Globe size={20} style={{ color: 'var(--sage)', marginBottom: '8px' }} />
                <strong style={{ fontSize: '1.2rem', color: 'var(--sage-light)' }}>{data?.language || 'Awaiting'}</strong>
                <span className="io-subtext">Detected Language</span>
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="horizontal-io-flow">
            <div className="io-column">
              <div className="io-label">INPUT</div>
              <div className="io-box">
                 <Globe size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                 <strong>Multilingual Transcript</strong>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">AI PROCESS</div>
              <div className="io-process">
                <span>Named Entity Recognition</span>
                <span>Practice Identification</span>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column output-grow">
              <div className="io-label">OUTPUT</div>
              <div className="io-box success">
                <strong>Extracted Entities</strong>
                <div className="compact-tags" style={{ marginTop: '8px' }}>
                  {data?.people?.slice(0, 3).map((p, i) => <span key={i} className="mini-tag">👤 {p}</span>)}
                  {data?.culturalPractices?.slice(0, 3).map((p, i) => <span key={i} className="mini-tag">🎭 {p}</span>)}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="horizontal-io-flow">
            <div className="io-column">
              <div className="io-label">INPUT</div>
              <div className="io-box">
                <List size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <strong>Extracted Entities</strong>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column">
              <div className="io-label">AI PROCESS</div>
              <div className="io-process">
                <span>Geographical Mapping</span>
                <span>Taxonomy Classification</span>
              </div>
            </div>
            <div className="io-arrow"><ArrowRight size={20} /></div>
            <div className="io-column output-grow">
              <div className="io-label">OUTPUT</div>
              <div className="io-box success">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--ivory)' }}>
                  <MapPin size={16} style={{ color: 'var(--terracotta)' }}/> {data?.state} {data?.district ? `— ${data.district}` : ''}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--sage-light)' }}>Category: <strong>{data?.category}</strong></div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="stage-5-dashboard">
            <div className="s5-narrative">
              <div className="io-label">NARRATIVE</div>
              <p className="compact-narrative">"{inputText.substring(0, 200)}..."</p>
            </div>
            
            <div className="s5-flow-arrow"><ArrowDown size={20} /></div>
            
            <div className="s5-claims-header">
              <Database size={16} /> Extracted {data?.claims?.length || 0} Atomic Claims
            </div>

            <div className="s5-claims-grid">
              {data?.claims?.slice(0, 3).map((c, i) => (
                <div key={i} className="compact-claim-card">
                  <span className="claim-type">{c.claimType}</span>
                  <p>"{c.claim}"</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="stage-6-dashboard">
            <div className="s6-intro">
              <p>Transforms raw claims by evaluating required evidence and provenance.</p>
            </div>
            <div className="s6-transformation-list">
              {data?.claims?.slice(0, 4).map((claim, i) => (
                <div key={i} className="s6-transform-row">
                  <div className="s6-cell s6-claim">
                    <span className="cell-label">CLAIM</span>
                    <p>"{claim.claim}"</p>
                  </div>
                  <div className="s6-arrow"><ArrowRight size={16} /></div>
                  <div className="s6-cell s6-evidence">
                    <span className="cell-label">EVIDENCE REQUIRED</span>
                    <p>{claim.evidenceNeeded ? 'Archival / Documentary' : 'Oral / Community'}</p>
                  </div>
                  <div className="s6-arrow"><ArrowRight size={16} /></div>
                  <div className="s6-cell s6-provenance">
                    <span className="cell-label">PROVENANCE</span>
                    <p>{claim.reasoning}</p>
                  </div>
                  <div className="s6-arrow"><ArrowRight size={16} /></div>
                  <div className="s6-cell s6-status">
                    <span className="cell-label">STATUS</span>
                    <span className={`badge ${getStatusBadgeClass(claim.status)}`}>{claim.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="stage-7-dashboard">
            <div className="s7-hero">
              <Check size={32} className="s7-icon" />
              <h2>CULTURAL RECORD READY</h2>
            </div>

            <div className="s7-grid">
              <div className="s7-field"><label>Title</label><span>{data?.title}</span></div>
              <div className="s7-field"><label>Category</label><span>{data?.category}</span></div>
              <div className="s7-field"><label>Language</label><span>{data?.language}</span></div>
              <div className="s7-field"><label>Location</label><span>{data?.state} {data?.district ? `, ${data.district}` : ''}</span></div>
              <div className="s7-field"><label>Community</label><span>{data?.community || 'Not specified'}</span></div>
              <div className="s7-field"><label>Practices</label><span>{data?.culturalPractices?.length ? data.culturalPractices.join(', ') : 'None extracted'}</span></div>
              <div className="s7-field"><label>Total Claims</label><span>{data?.claims?.length || 0} Extracted</span></div>
              <div className="s7-field"><label>Evidence Status</label><span>{data?.claims?.filter(c => c.evidenceNeeded).length || 0} Need Evidence</span></div>
            </div>

            <div className="s7-summary">
              <h4>OBJECTIVE CULTURAL SUMMARY</h4>
              <p>{data?.summary}</p>
            </div>

            <details className="s7-json-collapse">
              <summary>STRUCTURED JSON</summary>
              <pre className="json-viewer"><code>{JSON.stringify(data, null, 2)}</code></pre>
            </details>

            <div className="s7-actions">
              <button className="btn btn-primary" onClick={() => navigate('/verification')}>Review Record</button>
              <button className="btn btn-secondary">Edit</button>
              <button className="btn btn-secondary" onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "structured_record.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}>
                <Download size={16} /> Export JSON
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="ai-page page-enter" id="ai-pipeline-page">
      <div className="section-header" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', letterSpacing: '-0.5px' }}>{t('pipeline.aiPipeline')}</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '650px', margin: '8px auto 0', fontSize: '1rem' }}>
          Transforms local community knowledge into structured, traceable, and archivable digital heritage records.
        </p>
      </div>

      {/* SOURCE RECORD PANEL (MOVED UP, COMPACT) */}
      <div className="source-record-panel">
        <div className="source-header" onClick={() => setSourceExpanded(!sourceExpanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} style={{ color: 'var(--turmeric)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--ivory)' }}>Source Record</h3>
          </div>
          <button className="icon-btn">{sourceExpanded ? 'Collapse' : 'Expand'} <ChevronDown size={16} style={{ transform: sourceExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} /></button>
        </div>
        
        {sourceExpanded && (
          <div className="source-content">
            <div className="presets-row">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Presets:</span>
              {PRESET_SAMPLES.map((sample, idx) => (
                <button key={idx} type="button" className="preset-chip" onClick={() => { setSelectedRecordId(''); setInputText(sample.text); }}>
                  {sample.label}
                </button>
              ))}
            </div>
            <textarea
              className="demo-textarea compact"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste or type oral narrative..."
              rows={3}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={runPipeline} disabled={isProcessing || !inputText.trim()}>
                {isProcessing ? <><RefreshCw size={14} className="spin" /> Processing...</> : <><Play size={14} /> Run Pipeline</>}
              </button>
              {apiError && <span style={{ color: 'var(--madder)', fontSize: '0.85rem' }}>{apiError}</span>}
            </div>
          </div>
        )}
      </div>

      {/* HORIZONTAL TIMELINE NAV */}
      <div className="pipeline-horizontal-nav" style={{ marginTop: 'var(--space-2xl)' }}>
        {STAGES.map((stage, idx) => {
          const isCompleted = completedSteps.has(stage.id);
          const isCurrent = activeStep === stage.id && isProcessing;
          const isActive = selectedStageId === stage.id;
          let stateClass = '';
          if (isCompleted) stateClass = 'completed';
          else if (isCurrent) stateClass = 'processing';
          
          return (
            <div key={stage.id} className="pipeline-nav-item-wrapper">
              <button
                className={`pipeline-nav-item ${stateClass} ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <div className="nav-icon">{stage.icon}</div>
                <div className="nav-details">
                  <span className="nav-step-num">0{stage.id}</span>
                  <span className="nav-short-title">{stage.shortTitle}</span>
                </div>
              </button>
              {idx < STAGES.length - 1 && <div className={`nav-connector ${isCompleted ? 'completed' : ''}`} />}
            </div>
          );
        })}
      </div>

      {/* STAGE DETAIL VIEWER */}
      <div className="stage-detail-viewer">
        <div className="stage-detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stage-detail-icon">{STAGES[selectedStageId - 1].icon}</div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--ivory)', fontSize: '1.2rem' }}>Stage 0{selectedStageId}: {STAGES[selectedStageId - 1].title}</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{STAGES[selectedStageId - 1].description}</p>
            </div>
          </div>
        </div>
        
        <div className="stage-detail-content">
          {renderStageContent()}
        </div>

        {/* BOTTOM NAVIGATION & PROGRESS */}
        <div className="stage-bottom-nav">
          <button 
            className="nav-arrow-btn" 
            disabled={selectedStageId === 1}
            onClick={() => setSelectedStageId(prev => Math.max(1, prev - 1))}
          >
            ← Stage 0{selectedStageId - 1}
          </button>
          
          <div className="stage-progress">
            <span className="progress-text">STAGE {selectedStageId} OF 7</span>
            <div className="progress-track" style={{ '--progress-width': `${((selectedStageId - 1) / 6) * 100}%` } as React.CSSProperties}>
              {STAGES.map(s => (
                <div key={s.id} className={`progress-dot ${s.id === selectedStageId ? 'active' : s.id < selectedStageId ? 'completed' : ''}`} />
              ))}
            </div>
          </div>

          <button 
            className="nav-arrow-btn" 
            disabled={selectedStageId === 7}
            onClick={() => setSelectedStageId(prev => Math.min(7, prev + 1))}
          >
            Stage 0{selectedStageId + 1} →
          </button>
        </div>
      </div>

      {/* COMPACT AI GOVERNANCE ACCORDION */}
      <details className="ai-governance-accordion">
        <summary>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} style={{ color: 'var(--turmeric)' }} />
            <strong>AI Governance & Transparency</strong>
          </div>
          <span className="summary-hint">Click to expand</span>
        </summary>
        <div className="accordion-content">
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <li>AI organizes and structures extracted claims.</li>
            <li>AI <strong>does not</strong> certify authenticity or declare historical truth.</li>
            <li>Human reviewers, community knowledge holders, and archival evidence remain responsible for verification.</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
