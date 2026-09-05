import { useState, useRef } from 'react';
import { Camera, Upload, RefreshCw, Box, Compass, Hammer, History, Info, Sparkles } from 'lucide-react';
import { useTranslation } from '../../contexts/I18nContext';
import './HeritageLens.css';

interface LensAnalysis {
  structure_type: string;
  confidence: string;
  architecture_json: { style?: string; notable_elements?: string[] };
  materials_json: { primary?: string; details?: string };
  engineering_json: { structural_system?: string; techniques?: string };
  history_json: { likely_era?: string; context?: string };
}

export default function HeritageLens() {
  const { t } = useTranslation();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LensAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'architecture' | 'materials' | 'engineering' | 'history'>('architecture');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setAnalysis(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;

    try {
      setIsAnalyzing(true);
      setError(null);

      const formData = new FormData();
      formData.append('image', imageFile);

      // We assume user is authenticated, but backend handles optional uploaded_by.
      // If we need user ID, we can get it from context. Skipping for brevity as it's optional.

      const res = await fetch('http://localhost:8000/api/heritage-lens/analyze', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400) {
          throw new Error(errData.detail || 'Invalid image or upload format.');
        } else if (res.status === 502) {
          throw new Error(errData.detail || 'Analysis service is temporarily unavailable.');
        } else {
          throw new Error('An unexpected server error occurred.');
        }
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="lens-container">
      <div className="lens-header">
        <h1><Sparkles className="lens-icon-main" /> {t('lens.heritageLens')}</h1>
        <p>AI-assisted visual analysis of monuments and structures.</p>
      </div>

      <div className="lens-content-wrapper">
        <div className="lens-upload-section premium-glass">
          {!imagePreview ? (
            <div className="lens-dropzone" onClick={() => fileInputRef.current?.click()}>
              <div className="dropzone-icons">
                <Camera size={40} />
                <span className="drop-divider">or</span>
                <Upload size={40} />
              </div>
              <h3>Capture or Upload Monument</h3>
              <p>Take a photo or upload an image to identify the structure's architecture and history.</p>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden-input" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button className="btn btn-primary lens-btn">Choose Image</button>
            </div>
          ) : (
            <div className="lens-preview-box">
              <img src={imagePreview} alt="Monument preview" className="lens-preview-img" />
              <div className="preview-actions">
                <button className="btn btn-secondary" onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                  setAnalysis(null);
                }}>
                  Change Image
                </button>
                <button 
                  className="btn btn-primary btn-glow" 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? <RefreshCw className="spin" size={18} /> : <Sparkles size={18} />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Structure'}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="lens-error-box">
            <Info size={20} />
            <p>{error}</p>
          </div>
        )}

        {analysis && (
          <div className="lens-results-section premium-glass">
            {analysis.confidence === 'Low' ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <Info size={32} style={{ color: 'var(--accent-sage)', marginBottom: '1rem' }} />
                <h3>Analysis Unclear</h3>
                <p style={{ color: 'var(--text-muted)' }}>Couldn't confidently identify this — try a clearer photo.</p>
              </div>
            ) : (
              <>
                <div className="results-header">
                  <span className="confidence-badge">
                    Confidence: {analysis.confidence}
                  </span>
                  <h2>{analysis.structure_type}</h2>
                </div>

            <div className="lens-tabs">
              <button 
                className={`lens-tab ${activeTab === 'architecture' ? 'active' : ''}`}
                onClick={() => setActiveTab('architecture')}
              >
                <Box size={16} /> Architecture
              </button>
              <button 
                className={`lens-tab ${activeTab === 'materials' ? 'active' : ''}`}
                onClick={() => setActiveTab('materials')}
              >
                <Hammer size={16} /> Materials
              </button>
              <button 
                className={`lens-tab ${activeTab === 'engineering' ? 'active' : ''}`}
                onClick={() => setActiveTab('engineering')}
              >
                <Compass size={16} /> Engineering
              </button>
              <button 
                className={`lens-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <History size={16} /> History
              </button>
            </div>

            <div className="lens-tab-content">
              {activeTab === 'architecture' && (
                <div className="lens-panel">
                  <h4>Style</h4>
                  <p>{analysis.architecture_json?.style || 'Not identified'}</p>
                  
                  <h4>Notable Elements</h4>
                  <ul>
                    {analysis.architecture_json?.notable_elements?.map((el, i) => (
                      <li key={i}>{el}</li>
                    )) || <li>None noted</li>}
                  </ul>
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="lens-panel">
                  <h4>Primary Material</h4>
                  <p>{analysis.materials_json?.primary || 'Not identified'}</p>
                  
                  <h4>Details</h4>
                  <p>{analysis.materials_json?.details || 'N/A'}</p>
                </div>
              )}

              {activeTab === 'engineering' && (
                <div className="lens-panel">
                  <h4>Structural System</h4>
                  <p>{analysis.engineering_json?.structural_system || 'Not identified'}</p>
                  
                  <h4>Techniques</h4>
                  <p>{analysis.engineering_json?.techniques || 'N/A'}</p>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="lens-panel">
                  <h4>Likely Era</h4>
                  <p>{analysis.history_json?.likely_era || 'Not identified'}</p>
                  
                  <h4>Context</h4>
                  <p>{analysis.history_json?.context || 'N/A'}</p>
                </div>
              )}
            </div>

            <div className="lens-disclaimer">
              <Info size={16} className="text-terracotta" />
              <p><strong>Disclaimer:</strong> This is an AI-generated visual analysis intended for preliminary discovery. It is not a verified historical record and has not been routed through the human verification pipeline.</p>
              {/* TODO: Add 'Submit this as a heritage record' button here in future */}
            </div>
            </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
