import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw, Volume2, Globe, Headphones, Mic, Info, CheckCircle, ChevronDown, Database, Sparkles, ArrowRight } from 'lucide-react';
import { generateAudioNarrationScript } from '../services/geminiService';
import type { CulturalRecord } from '../data/types';
import { formatPlaybackTime } from '../utils/audioDuration';
import './styles/HeritageAudioPlayer.css';

interface HeritageAudioPlayerProps {
  record: CulturalRecord;
}

export default function HeritageAudioPlayer({ record }: HeritageAudioPlayerProps) {
  const [language, setLanguage] = useState<string>('English');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [narrationText, setNarrationText] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  // Community voice states
  const [communityPlaying, setCommunityPlaying] = useState(false);
  const [communityTime, setCommunityTime] = useState(0);
  const [communityDuration, setCommunityDuration] = useState(0);

  const [showCreationInfo, setShowCreationInfo] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const communityRef = useRef<HTMLAudioElement | null>(null);

  // Stop community audio if AI audio plays and vice versa
  useEffect(() => {
    if (isPlaying && communityPlaying && communityRef.current) {
      communityRef.current.pause();
      setCommunityPlaying(false);
    }
  }, [isPlaying, communityPlaying]);

  useEffect(() => {
    if (communityPlaying && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [communityPlaying, isPlaying]);

  // Clean up
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (communityRef.current) communityRef.current.pause();
    };
  }, []);

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setAudioUrl('');
    setNarrationText('');
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const generateAndPlay = async () => {
    if (audioUrl && audioRef.current) {
      // Audio already exists, just play
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // 1. Get Script from Gemini
      const scriptRes = await generateAudioNarrationScript(record, language);
      if (!scriptRes.success || !scriptRes.text) throw new Error(scriptRes.error || "Failed to generate script");
      
      setNarrationText(scriptRes.text);

      // 2. Get TTS from Backend
      const ttsRes = await fetch('http://localhost:8000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptRes.text, language })
      });

      if (!ttsRes.ok) throw new Error("TTS API unavailable");
      
      const ttsData = await ttsRes.json();
      if (ttsData.error) throw new Error(ttsData.error);
      
      const newUrl = ttsData.audioUrl;
      setAudioUrl(newUrl);

      // Play
      if (audioRef.current) {
        audioRef.current.src = newUrl;
        audioRef.current.load();
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err: any) {
      setError(err.message || 'Audio narration is currently unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioUrl && !isPlaying) {
      generateAndPlay();
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };
  const handleSpeedChange = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 0.75 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  // Community Audio Handlers
  const toggleCommunityPlay = () => {
    if (communityRef.current) {
      if (communityPlaying) {
        communityRef.current.pause();
        setCommunityPlaying(false);
      } else {
        communityRef.current.play();
        setCommunityPlaying(true);
      }
    }
  };

  return (
    <div className="heritage-audio-container">
      {/* Hidden Audio Elements */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
      {record.originalAudioUrl && (
        <audio 
          ref={communityRef}
          src={record.originalAudioUrl}
          onTimeUpdate={() => setCommunityTime(communityRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setCommunityDuration(communityRef.current?.duration || 0)}
          onEnded={() => setCommunityPlaying(false)}
          style={{ display: 'none' }}
        />
      )}

      {/* SECTION 1: AI NARRATION */}
      <div className="audio-player-card premium-glass">
        <div className="audio-header">
          <div className="audio-title-group">
            <Headphones className="audio-icon" size={24} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3>LISTEN TO THIS HERITAGE</h3>
                <span className="ai-transparency-badge" title="This narration was generated from the structured cultural record and converted to audio using text-to-speech.">
                  <Sparkles size={12} /> AI-assisted narration
                </span>
              </div>
              <p>Explore this heritage through an audio narration.</p>
            </div>
          </div>
          
          <div className="audio-lang-selector">
            <Globe size={16} />
            <select value={language} onChange={handleLanguageChange} disabled={isLoading}>
              <option value="English">🇮🇳 English</option>
              <option value="Hindi">🇮🇳 Hindi</option>
              <option value="Marathi">🇮🇳 Marathi</option>
            </select>
          </div>
        </div>

        <div className="audio-info">
          <h4>{record.title}</h4>
          <span>{record.category?.replace('_', ' ')} • {record.state}</span>
        </div>

        {error ? (
          <div className="audio-error">
            <p>⚠ {error}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>Read Instead</button>
          </div>
        ) : (
          <div className="audio-controls-row">
            <button 
              className={`btn-play-circle ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
              disabled={isLoading}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? <RefreshCw className="spin" size={24} /> : isPlaying ? <Pause size={24} /> : <Play size={24} style={{marginLeft: '4px'}} />}
            </button>

            <div className="audio-scrubber-wrapper">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="audio-scrubber"
                disabled={!audioUrl}
                aria-label="Seek time"
              />
              <div className="scrubber-times">
                <span>{formatPlaybackTime(currentTime)}</span>
                <span>{duration ? formatPlaybackTime(duration) : '--:--'}</span>
              </div>
            </div>

            <button className="btn-speed" onClick={handleSpeedChange} aria-label="Playback speed">
              {playbackSpeed}×
            </button>
            <Volume2 size={20} className="volume-icon" />
          </div>
        )}
      </div>

      {/* AI NARRATION TRANSCRIPT */}
      {(narrationText || isLoading) && (
        <div className="audio-transcript-box">
          <div className="transcript-label">🎧 AI NARRATION</div>
          {isLoading ? (
            <p className="loading-text">Preparing {language} narration...</p>
          ) : (
            <>
              <p className="transcript-text">"{narrationText}"</p>
              
              <div className="creation-info-wrapper">
                <button 
                  className="btn-creation-toggle" 
                  onClick={() => setShowCreationInfo(!showCreationInfo)}
                >
                  <Info size={14} /> How was this narration created?
                  <ChevronDown size={14} style={{ transform: showCreationInfo ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>
                
                {showCreationInfo && (
                  <div className="creation-info-card">
                    <h5 className="creation-card-title">HOW WAS THIS NARRATION CREATED?</h5>
                    
                    <div className="creation-grid">
                      <div className="creation-row">
                        <span className="cr-label">Source</span>
                        <span className="cr-value"><CheckCircle size={12} className="text-sage" /> Verified Structured Cultural Record</span>
                      </div>
                      <div className="creation-row">
                        <span className="cr-label">Content Generation</span>
                        <span className="cr-value"><Sparkles size={12} className="text-turmeric" /> AI-assisted narration</span>
                      </div>
                      <div className="creation-row">
                        <span className="cr-label">Voice Generation</span>
                        <span className="cr-value"><Volume2 size={12} className="text-indigo" /> Text-to-Speech</span>
                      </div>
                      <div className="creation-row">
                        <span className="cr-label">Language</span>
                        <span className="cr-value">🇮🇳 {language}</span>
                      </div>
                      <div className="creation-row">
                        <span className="cr-label">Record Status</span>
                        <span className="cr-value">
                          {record.verificationStatus === 'source_supported' || record.verificationStatus === 'community_verified' ? (
                            <><CheckCircle size={12} className="text-sage" /> Verified / Approved</>
                          ) : (
                            <><Info size={12} className="text-terracotta" /> {record.verificationStatus.replace('_', ' ')}</>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="creation-disclaimer">
                      <Info size={16} style={{ flexShrink: 0 }} />
                      <p>AI generates the narration from the documented cultural record. It does not independently verify historical truth.</p>
                    </div>
                    
                    <div className="creation-footer">
                      <span className="powered-by"><Database size={12} /> Powered by the Structured Cultural Record</span>
                      <a href="#provenance-lifecycle-timeline" className="provenance-link">View Full Provenance <ArrowRight size={12} /></a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION 2: COMMUNITY VOICE */}
      {record.originalAudioUrl && (
        <div className="community-voice-card">
          <div className="cv-header">
            <Mic size={24} style={{ color: 'var(--terracotta)' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4>🎙️ COMMUNITY VOICE</h4>
                <span className="cv-provenance-badge">Original Community Contribution</span>
              </div>
              <p>Original contribution from a community member.</p>
            </div>
          </div>
          
          <div className="cv-controls">
            <button className="btn-play-sm" onClick={toggleCommunityPlay}>
              {communityPlaying ? <Pause size={16} /> : <Play size={16} />} 
              {communityPlaying ? 'Pause Original' : 'Play Community Voice'}
            </button>
            <span className="cv-time">{formatPlaybackTime(communityTime)} / {communityDuration ? formatPlaybackTime(communityDuration) : '--:--'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
