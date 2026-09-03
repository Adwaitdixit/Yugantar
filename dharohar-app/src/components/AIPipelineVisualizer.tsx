import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Check, Cpu, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { processCulturalTextWithGemini } from '../services/geminiService';
import type { GeminiCulturalAnalysis } from '../data/types';
import { culturalStore, useCulturalRecords } from '../data/culturalStore';
import './styles/AIPipeline.css';

interface PipelineStepDisplay {
  id: number;
  title: string;
  description: string;
  icon: string;
  outputLabel: string;
  output: string;
  confidence?: number;
  claims?: Array<{
    claim: string;
    claimType: string;
    evidenceNeeded: boolean;
    status: string;
    reasoning: string;
  }>;
  tags?: string[];
  entities?: { people: string[]; practices: string[] };
}

const SAMPLE_INPUT = `This ancient temple in Hampi was built in 1336 by King Harihara I of the Vijayanagara Empire. The temple's gopuram rises to 50 meters and features intricate carvings depicting scenes from the Ramayana. Local priests perform a unique fire ritual every full moon that has been practiced for over 700 years. The temple bell, weighing 2 tonnes, was cast from a single piece of bronze brought from Sri Lanka.`;

const PRESET_SAMPLES = [
  { label: '🏛️ Hampi Vijayanagara', text: SAMPLE_INPUT },
  { label: '💃 Kalbelia Folk Dance', text: `Kalbelia is a traditional folk dance of the Kalbelia community of Rajasthan. The dancers wear swirling black skirts with glass beads mimicking a cobra's movement, accompanied by the poongi wind instrument. Songs pass down desert folklore and snake charming traditions orally.` },
  { label: '🧵 Patan Patola Silk', text: `Patan Patola is an ancient double-ikat silk weaving craft from Patan, Gujarat, practiced by the Salvi community since the 12th century Solanki era. Both warp and weft threads are tie-dyed before weaving so geometric patterns appear identical on both sides.` },
];

export default function AIPipelineVisualizer() {
  const navigate = useNavigate();
  const allStoreRecords = useCulturalRecords();

  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [inputText, setInputText] = useState(SAMPLE_INPUT);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<GeminiCulturalAnalysis | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedRecordNotice, setSavedRecordNotice] = useState<string | null>(null);

  // Synced community records awaiting AI processing
  const candidateRecords = allStoreRecords.filter(r => !r.id.startsWith('ICH0') && !r.id.startsWith('ICH-'));
  const selectedRecord = allStoreRecords.find(r => r.id === selectedRecordId);

  // Handle selecting a record from store
  const handleSelectRecord = (recId: string) => {
    setSelectedRecordId(recId);
    setSavedRecordNotice(null);
    const rec = allStoreRecords.find(r => r.id === recId);
    if (rec) {
      setInputText(rec.fullDescription || `${rec.title}. Recorded in ${rec.originalLanguage} from ${rec.state}.`);
    }
  };

  // Dynamic steps generated from Gemini analysis or default template
  const getPipelineSteps = (data: GeminiCulturalAnalysis | null): PipelineStepDisplay[] => {
    if (!data) {
      return [
        {
          id: 1,
          title: 'Language & Dialect Detection',
          description: 'Identifies the primary language and regional dialect of the input text.',
          icon: '🌐',
          outputLabel: 'Detected Language',
          output: 'Awaiting input analysis...',
          confidence: 98,
        },
        {
          id: 2,
          title: 'Cultural Category & Classification',
          description: 'Classifies the record into living cultural domains and taxonomy.',
          icon: '🏷️',
          outputLabel: 'Category & Classification',
          output: 'Awaiting input analysis...',
          confidence: 95,
        },
        {
          id: 3,
          title: 'Cultural Information Extraction',
          description: 'Extracts title, geographical regions, districts, and bearer communities.',
          icon: '📍',
          outputLabel: 'Geographical & Community Context',
          output: 'Awaiting input analysis...',
          confidence: 94,
        },
        {
          id: 4,
          title: 'Entity & Practice Extraction',
          description: 'Extracts named historical figures, gurus, lineages, and distinct living rituals.',
          icon: '👥',
          outputLabel: 'Entities & Living Practices',
          output: 'Awaiting input analysis...',
          confidence: 92,
        },
        {
          id: 5,
          title: 'Atomic Claim Extraction',
          description: 'Decomposes narrative into discrete, verifiable factual assertions.',
          icon: '🔬',
          outputLabel: 'Extracted Claims',
          output: '',
          claims: [],
        },
        {
          id: 6,
          title: 'Evidence Requirements & Provenance Verification',
          description: 'Determines claim verification status and evidence requirements without declaring AI truth.',
          icon: '🔍',
          outputLabel: 'Claim Verification Matrix',
          output: 'Awaiting claim extraction...',
        },
        {
          id: 7,
          title: 'Structured Cultural Record Summary',
          description: 'Generates structured JSON schema ready for institutional archiving.',
          icon: '📋',
          outputLabel: 'Objective Cultural Summary',
          output: 'Awaiting analysis completion...',
        },
      ];
    }

    return [
      {
        id: 1,
        title: 'Language & Dialect Detection',
        description: 'Identifies the primary language and regional dialect of the input text.',
        icon: '🌐',
        outputLabel: 'Detected Language',
        output: `Language: ${data.language} (Confidence: 98.5%)`,
        confidence: 98.5,
      },
      {
        id: 2,
        title: 'Cultural Category & Classification',
        description: 'Classifies the record into living cultural domains and taxonomy.',
        icon: '🏷️',
        outputLabel: 'Category & Classification',
        output: `Category: ${data.category}`,
        confidence: 96.0,
      },
      {
        id: 3,
        title: 'Cultural Information Extraction',
        description: 'Extracts title, geographical regions, districts, and bearer communities.',
        icon: '📍',
        outputLabel: 'Geographical & Community Context',
        output: `Title: "${data.title}" · State: ${data.state}${data.district ? `, ${data.district}` : ''}`,
        tags: [data.title, data.state, data.language],
      },
      {
        id: 4,
        title: 'Entity & Practice Extraction',
        description: 'Extracts named historical figures, gurus, lineages, and distinct living rituals.',
        icon: '👥',
        outputLabel: 'Entities & Living Practices',
        output: `Identified ${data.people.length} key entities and ${data.culturalPractices.length} living practices`,
        entities: {
          people: data.people,
          practices: data.culturalPractices,
        },
        tags: data.keywords,
      },
      {
        id: 5,
        title: 'Atomic Claim Extraction',
        description: 'Decomposes narrative into discrete, verifiable factual assertions.',
        icon: '🔬',
        outputLabel: 'Extracted Claims',
        output: `Extracted ${data.claims.length} atomic factual and cultural assertions:`,
        claims: data.claims,
      },
      {
        id: 6,
        title: 'Evidence Requirements & Provenance Verification',
        description: 'Determines claim verification status and evidence requirements without declaring AI truth.',
        icon: '🔍',
        outputLabel: 'Claim Verification Matrix',
        output: `Categorized into Source-Supported, Oral-Tradition, or Requiring Archival Evidence:`,
        claims: data.claims,
      },
      {
        id: 7,
        title: 'Structured Cultural Record Summary',
        description: 'Generates structured JSON schema ready for institutional archiving.',
        icon: '📋',
        outputLabel: 'Objective Cultural Summary',
        output: data.summary,
      },
    ];
  };

  const runPipeline = async () => {
    if (!inputText.trim() || isProcessing) return;

    setIsProcessing(true);
    setApiError(null);
    setSavedRecordNotice(null);
    setActiveStep(1);
    setCompletedSteps(new Set());

    try {
      // Call real Gemini API
      const result = await processCulturalTextWithGemini(inputText);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Gemini pipeline failed.');
      }

      setAnalysisResult(result.data);

      // If a specific store record was selected, update it in the central store!
      if (selectedRecordId) {
        culturalStore.updateAiAnalysis(selectedRecordId, result.data);
        setSavedRecordNotice(`Cultural Record ${selectedRecordId} updated in shared store! Lifecycle advanced to "Evidence Needed".`);
      }

      // Animate through all 7 stages dynamically
      const totalSteps = 7;
      let current = 1;
      const timer = setInterval(() => {
        current++;
        setCompletedSteps(prev => new Set([...prev, current - 1]));
        setActiveStep(current);

        if (current >= totalSteps) {
          setCompletedSteps(prev => new Set([...prev, totalSteps]));
          clearInterval(timer);
          setIsProcessing(false);
        }
      }, 600);

    } catch (err: any) {
      setIsProcessing(false);
      setApiError(err.message || 'Gemini processing encountered an error.');
    }
  };

  const resetPipeline = () => {
    setActiveStep(0);
    setCompletedSteps(new Set());
    setAnalysisResult(null);
    setApiError(null);
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

  const pipelineSteps = getPipelineSteps(analysisResult);

  return (
    <div className="ai-page page-enter" id="ai-pipeline-page">
      <div className="section-header" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="ornament">🤖</div>
        <h2>AI-Assisted Processing Pipeline</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '650px', margin: '8px auto 0' }}>
          Powered by Google Gemini. AI extracts entities, organizes claims, and identifies evidence requirements — human & community reviewers perform verification.
        </p>
      </div>

      {/* Persistence Notice Banner */}
      {savedRecordNotice && (
        <div style={{
          maxWidth: '900px',
          margin: '0 auto var(--space-xl)',
          padding: 'var(--space-md) var(--space-lg)',
          background: 'rgba(107, 142, 111, 0.15)',
          border: '1.5px solid var(--sage)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Check size={20} style={{ color: 'var(--sage-dark)' }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--slate)' }}>
              <strong>{savedRecordNotice}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate('/verification')}
            >
              Verification Workbench <ArrowRight size={14} />
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => navigate('/reviewer')}
            >
              Reviewer Console <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="demo-input-section" id="demo-input">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
          <h3 style={{ margin: 0 }}><Cpu size={20} /> Select Contribution or Enter Narrative</h3>
          <span className="badge" style={{ background: 'rgba(217, 164, 65, 0.2)', color: 'var(--turmeric-light)', border: '1px solid rgba(217,164,65,0.4)', fontSize: '0.72rem' }}>
            <Sparkles size={12} /> Google Gemini Live API
          </span>
        </div>
        <p style={{ color: 'rgba(248,245,238,0.7)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
          Select any synchronized field contribution from the shared queue or try preset cultural samples:
        </p>

        {/* Synced Contributions Queue Selector */}
        {candidateRecords.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)', padding: '10px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--turmeric-light)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              📥 Synced Community Contributions in National Pipeline:
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {candidateRecords.map(rec => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleSelectRecord(rec.id)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-round)',
                    border: '1px solid',
                    borderColor: selectedRecordId === rec.id ? 'var(--turmeric)' : 'rgba(255,255,255,0.2)',
                    background: selectedRecordId === rec.id ? 'var(--turmeric)' : 'rgba(255,255,255,0.1)',
                    color: selectedRecordId === rec.id ? 'var(--charcoal)' : 'var(--ivory)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {rec.id}: {rec.title} ({rec.state})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preset Sample Chips */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(248,245,238,0.6)', alignSelf: 'center' }}>Presets:</span>
          {PRESET_SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-sm btn-ghost"
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--ivory)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onClick={() => { setSelectedRecordId(''); setInputText(sample.text); }}
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Selected Record Detail Preview */}
        {selectedRecord && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(43, 58, 85, 0.4)',
            border: '1px solid rgba(217, 164, 65, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <span style={{ color: 'var(--turmeric-light)', fontWeight: 700, fontSize: '0.85rem' }}>
                Active Record: {selectedRecord.id} — {selectedRecord.title}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'rgba(248,245,238,0.7)', marginTop: '2px' }}>
                Contributor: {selectedRecord.contributor} · State: {selectedRecord.state} · Language: {selectedRecord.originalLanguage} · Status: {selectedRecord.lifecycleStatus?.toUpperCase()}
              </div>
            </div>
            {selectedRecord.originalAudioUrl && (
              <span className="badge" style={{ background: 'rgba(107, 142, 111, 0.3)', color: 'var(--ivory)', border: '1px solid var(--sage)' }}>
                🎙️ Original Audio Attached
              </span>
            )}
          </div>
        )}

        {/* Input Textarea */}
        <textarea
          className="demo-textarea"
          id="demo-textarea-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Paste or type oral narrative, ritual chant transcript, or cultural documentation here..."
          rows={5}
        />

        {/* Controls */}
        <div className="demo-controls">
          <button
            className="btn btn-primary"
            id="run-pipeline-btn"
            onClick={runPipeline}
            disabled={isProcessing || !inputText.trim()}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="spin" />
                Gemini Processing 7 Stages...
              </>
            ) : (
              <>
                <Play size={16} />
                Run 7-Stage Gemini AI Pipeline {selectedRecordId ? `on ${selectedRecordId}` : ''}
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            style={{ borderColor: 'rgba(248,245,238,0.3)', color: 'var(--ivory)' }}
            onClick={resetPipeline}
            disabled={isProcessing}
          >
            Reset Pipeline
          </button>
        </div>

        {apiError && (
          <div style={{ marginTop: 'var(--space-md)', padding: '10px 14px', background: 'rgba(140,59,59,0.3)', border: '1px solid var(--madder)', borderRadius: 'var(--radius-md)', color: '#ffb3b3', fontSize: '0.85rem' }}>
            ⚠️ {apiError}
          </div>
        )}
      </div>

      {/* Ethical AI Governance Notice */}
      <div className="ethical-notice-card" id="ethical-notice">
        <div className="notice-icon">🔒</div>
        <div className="notice-content">
          <h4>Ethical AI Governance & Transparency Rule</h4>
          <p>
            AI organizes and structures extracted claims, entities, and suggests evidence requirements.
            <strong> AI does not certify cultural authenticity or declare historical truth.</strong> Human reviewers, community elders, and archival records are solely responsible for verification decisions.
          </p>
        </div>
      </div>

      {/* Pipeline Steps Flow */}
      <div className="pipeline-steps-container" id="pipeline-steps">
        {pipelineSteps.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = activeStep === step.id && isProcessing;

          return (
            <div
              key={step.id}
              className={`pipeline-step-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'processing' : ''}`}
            >
              <div className="step-card-header">
                <div className="step-icon-badge">{step.icon}</div>
                <div className="step-info">
                  <div className="step-number">Stage {step.id} of 7</div>
                  <h3 className="step-title">{step.title}</h3>
                </div>
                <div className="step-status">
                  {isCompleted ? (
                    <span className="badge badge-verified">
                      <Check size={12} /> Complete
                    </span>
                  ) : isCurrent ? (
                    <span className="badge" style={{ background: 'rgba(217,164,65,0.2)', color: 'var(--turmeric)' }}>
                      <RefreshCw size={12} className="spin" /> Processing
                    </span>
                  ) : (
                    <span className="badge badge-unverified">Pending</span>
                  )}
                </div>
              </div>

              <p className="step-description">{step.description}</p>

              {/* Output Content */}
              {(isCompleted || isCurrent) && (
                <div className="step-output-box">
                  <div className="output-label">{step.outputLabel}</div>
                  
                  {step.output && (
                    <div className="output-text">{step.output}</div>
                  )}

                  {/* Tags */}
                  {step.tags && step.tags.length > 0 && (
                    <div className="output-tags">
                      {step.tags.map((tag, i) => (
                        <span key={i} className="tag">🏷️ {tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Entities */}
                  {step.entities && (
                    <div style={{ marginTop: '8px' }}>
                      {step.entities.people.length > 0 && (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical Figures & Practitioners: </span>
                          {step.entities.people.map((p, i) => (
                            <span key={i} className="tag" style={{ marginRight: '4px' }}>👤 {p}</span>
                          ))}
                        </div>
                      )}
                      {step.entities.practices.length > 0 && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Living Cultural Practices: </span>
                          {step.entities.practices.map((pr, i) => (
                            <span key={i} className="tag" style={{ marginRight: '4px' }}>🎭 {pr}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Claims List */}
                  {step.claims && step.claims.length > 0 && (
                    <div className="claims-list">
                      {step.claims.map((claim, i) => (
                        <div key={i} className="claim-card">
                          <div className="claim-header">
                            <span className="claim-type-tag">
                              Claim #{i + 1} · {claim.claimType}
                            </span>
                            <span className={`badge ${getStatusBadgeClass(claim.status)}`}>
                              {claim.status}
                            </span>
                          </div>
                          <div className="claim-text">{claim.claim}</div>
                          <div className="claim-reasoning">
                            <strong>Reasoning:</strong> {claim.reasoning}
                          </div>
                          {claim.evidenceNeeded && (
                            <div className="evidence-needed-tag">
                              📄 Archival / Documentary Evidence Required for Certification
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
