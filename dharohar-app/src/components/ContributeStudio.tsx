import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Square, Upload, Check, RefreshCw,
  Play, Pause, FileAudio, Trash2, Image, AlertCircle,
  CloudUpload, Lock, Video, FileText, Search, X, ExternalLink, MapPin
} from 'lucide-react';
import { CATEGORY_CONFIG, CONSENT_CONFIG, type RecordCategory, type ConsentTier, type CulturalRecord } from '../data/types';
import { culturalStore, useCulturalRecords } from '../data/culturalStore';
import { resolveAccurateAudioDuration, formatAudioDuration, formatPlaybackTime } from '../utils/audioDuration';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/I18nContext';
import { supabase, uploadAudioRecording, uploadVideoFile } from '../services/supabaseClient';
import './styles/ContributeStudio.css';

interface ContributeStudioProps {
  isOnline: boolean;
  onAddPending: () => void;
  onRequireAuth?: (intent: 'record' | 'view_data' | 'general') => void;
}

interface UploadedFile {
  file?: File;
  blob?: Blob;
  name: string;
  size: string;
  bytes?: number;
  url: string;
  duration: number | null; // Real duration in seconds, or null if cannot be determined
  durationResolved: boolean;
}

const DRAFT_STORAGE_KEY = 'dharohar_active_contribution_draft_v1';

export default function ContributeStudio({ onRequireAuth }: ContributeStudioProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const allStoreRecords = useCulturalRecords();

  const [step, setStep] = useState(1);
  const [captureMode, setCaptureMode] = useState<'audio_record' | 'audio_upload' | 'video' | 'photo' | 'text'>('audio_record');
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState(false);
  const [syncingAllNotice, setSyncingAllNotice] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  
  // Real MediaRecorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorderBars, setRecorderBars] = useState<number[]>(Array.from({ length: 30 }, () => 5));
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<UploadedFile | null>(null);
  
  // File upload states
  const [uploadedAudio, setUploadedAudio] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<{ file: File; url: string; name: string }[]>([]);
  
  // Video and Text states
  const [uploadedVideo, setUploadedVideo] = useState<UploadedFile | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [writtenStory, setWrittenStory] = useState('');
  const [recipeData, setRecipeData] = useState<{ ingredients: string[]; instructions: string[]; preparationTime?: string }>({ ingredients: [''], instructions: [''], preparationTime: '' });
  
  // Audio playback states
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isResolvingDuration, setIsResolvingDuration] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    audio?: string;
    title?: string;
    category?: string;
    language?: string;
    state?: string;
  }>({});

  // Form Details
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecordCategory>('oral_story');
  const [language, setLanguage] = useState('');
  const [dialect, setDialect] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [community, setCommunity] = useState('');
  const [knowledgeHolder, setKnowledgeHolder] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [consentTier, setConsentTier] = useState<ConsentTier>('public');

  // External Reference State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedReference, setSelectedReference] = useState<any | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Last submitted record notice

  // Auto-detect with navigator.geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates([position.coords.longitude, position.coords.latitude]);
          console.log('[Geocoding] Auto-detected coords:', position.coords.latitude, position.coords.longitude);
        },
        (err) => console.warn('[Geocoding] Geolocation error:', err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // References for MediaRecorder and Audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);

  // Active audio object (either recorded or uploaded)
  const activeAudio = captureMode === 'audio_record' ? recordedAudio : uploadedAudio;
  const currentAudioDuration = activeAudio?.duration ?? audioDuration;

  // Restore draft audio on mount if page was refreshed
  useEffect(() => {
    try {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftJson) {
        const parsed = JSON.parse(draftJson);
        if (parsed && (parsed.url || parsed.dataUrl)) {
          const audioUrl = parsed.dataUrl || parsed.url;
          console.log('[DraftPersistence] Restoring saved audio recording from localStorage after refresh:', {
            name: parsed.name,
            size: parsed.size,
            duration: parsed.duration,
          });
          const restoredItem: UploadedFile = {
            name: parsed.name,
            size: parsed.size,
            bytes: parsed.bytes,
            url: audioUrl,
            duration: parsed.duration !== undefined ? parsed.duration : null,
            durationResolved: true,
          };
          setRecordedAudio(restoredItem);
          setAudioDuration(parsed.duration !== undefined ? parsed.duration : null);
        }
      }
    } catch (e) {
      console.warn('[DraftPersistence] Could not restore draft from localStorage:', e);
    }
  }, []);

  // Cleanup audio preview and streams on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      cancelAnimationFrame(animRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  // Debounced API Search for External Knowledge
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&origin=*`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const mappedResults = data.query.search.map((item: any) => ({
          title: item.title,
          snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
        }));
        setSearchResults(mappedResults);
      } catch (err) {
        console.error('Search failed', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  }, [searchQuery]);

  // Animate recorder bars and timer while recording
  useEffect(() => {
    if (isRecording) {
      const animate = () => {
        setRecorderBars(prev => prev.map(() => Math.max(8, Math.floor(Math.random() * 95))));
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      cancelAnimationFrame(animRef.current);
      clearInterval(timerRef.current);
    }
    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ============================================================
  // 1. REAL MEDIA RECORDER IMPLEMENTATION
  // ============================================================
  const startRealRecording = async () => {
    if (!user) {
      onRequireAuth?.('record');
      return;
    }

    setMicPermissionError(null);
    setValidationErrors(prev => ({ ...prev, audio: undefined }));

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionError('Microphone API is not supported in this browser. Please use the Upload Audio tab.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      console.log('[MediaRecorder] Initializing MediaRecorder with MIME type:', mimeType);
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('[MediaRecorder] ondataavailable chunk received:', e.data.size, 'bytes. Total chunks:', audioChunksRef.current.length);
        }
      };

      recorder.onstop = async () => {
        console.log('[MediaRecorder] onstop triggered.');
        console.log('[MediaRecorder] MediaRecorder state:', recorder.state);
        console.log('[MediaRecorder] MIME type:', mimeType);
        console.log('[MediaRecorder] Total chunks collected:', audioChunksRef.current.length);

        if (audioChunksRef.current.length === 0) {
          console.warn('[MediaRecorder] No audio chunks collected.');
          setMicPermissionError('No audio data was recorded. Please check your microphone and try again.');
          setIsRecording(false);
          return;
        }

        // 1. Create final Blob from ALL recorded chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('[MediaRecorder] Final Blob created. Size:', audioBlob.size, 'bytes', `(${(audioBlob.size / 1024).toFixed(2)} KB)`);

        if (audioBlob.size === 0) {
          console.warn('[MediaRecorder] Audio blob size is 0 bytes.');
          setMicPermissionError('Recording failed (empty audio blob). Please try again.');
          setIsRecording(false);
          return;
        }

        // 2. Create object URL from the Blob
        const blobUrl = URL.createObjectURL(audioBlob);
        console.log('[MediaRecorder] Created object URL:', blobUrl);

        const fileName = `field_recording_${Date.now()}.${mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'}`;

        // Stop all microphone tracks to release hardware
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }

        // Start duration resolution
        setIsResolvingDuration(true);
        const tempItem: UploadedFile = {
          blob: audioBlob,
          name: fileName,
          size: formatFileSize(audioBlob.size),
          bytes: audioBlob.size,
          url: blobUrl,
          duration: null,
          durationResolved: false,
        };
        setRecordedAudio(tempItem);
        setAudioDuration(null);

        // Measure exact elapsed recording time from recorder start to stop
        const elapsedSec = recordingStartTimeRef.current > 0
          ? Math.max(0.5, (Date.now() - recordingStartTimeRef.current) / 1000)
          : null;

        // 3-5. Resolve accurate duration using live elapsed time / AudioContext / HTMLAudioElement
        const realDuration = await resolveAccurateAudioDuration(audioBlob, blobUrl, elapsedSec);
        console.log('[MediaRecorder] Final resolved real audio.duration:', realDuration);

        // Convert Blob to Data URL for persistence across page refresh
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          try {
            const draftData = {
              name: fileName,
              size: formatFileSize(audioBlob.size),
              bytes: audioBlob.size,
              dataUrl,
              duration: realDuration,
            };
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
            console.log('[DraftPersistence] Saved recording to localStorage for persistence across refresh');
          } catch (e) {
            console.warn('[DraftPersistence] Could not save to localStorage:', e);
          }
        };

        setRecordedAudio(prev => prev ? { ...prev, duration: realDuration, durationResolved: true } : null);
        setAudioDuration(realDuration);
        setIsResolvingDuration(false);
        setIsRecording(false);
      };

      recorder.start(250); // collect chunks every 250ms
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      console.log('[MediaRecorder] Recording started successfully. state:', recorder.state);
    } catch (err: any) {
      console.error('[MediaRecorder] Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionError('Microphone permission was denied. Please allow microphone access in your browser settings or use the "Upload Audio File" tab.');
      } else {
        setMicPermissionError(`Could not access microphone (${err.message || 'Error'}). Please upload an audio file instead.`);
      }
      setIsRecording(false);
    }
  };

  const handleAttachDemoSample = (label: string) => {
    if (!user) {
      onRequireAuth?.('record');
      return;
    }

    setMicPermissionError(null);
    setValidationErrors(prev => ({ ...prev, audio: undefined }));

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const sampleRate = audioCtx.sampleRate || 44100;
      const numFrames = sampleRate * 3;
      const buffer = audioCtx.createBuffer(1, numFrames, sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < numFrames; i++) {
        channelData[i] = Math.sin((2 * Math.PI * 330 * i) / sampleRate) * 0.25 * (1 - i / numFrames);
      }

      // Convert buffer to WAV Blob
      const pcm16 = new Int16Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767));
      }

      const header = new ArrayBuffer(44);
      const view = new DataView(header);
      const writeString = (offset: number, str: string) => {
        for (let j = 0; j < str.length; j++) view.setUint8(offset + j, str.charCodeAt(j));
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + pcm16.byteLength, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, pcm16.byteLength, true);

      const blob = new Blob([header, pcm16.buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const recItem: UploadedFile = {
        blob,
        name: `${label}.wav`,
        size: formatFileSize(blob.size),
        bytes: blob.size,
        url,
        duration: 3,
        durationResolved: true,
      };

      if (captureMode === 'audio_record') {
        setRecordedAudio(recItem);
      } else {
        setUploadedAudio(recItem);
      }
      setAudioDuration(3);
    } catch (e) {
      console.warn('Audio demo creation:', e);
    }
  };

  const stopRealRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[MediaRecorder] Stopping recorder. current state:', mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleReRecord = () => {
    handleRemoveActiveAudio();
    startRealRecording();
  };

  // ============================================================
  // AUDIO FILE UPLOAD FALLBACK
  // ============================================================
  const handleAudioFile = async (file: File) => {
    if (!user) {
      onRequireAuth?.('record');
      return;
    }

    setUploadError(null);
    setValidationErrors(prev => ({ ...prev, audio: undefined }));

    console.log('[AudioUpload] Processing uploaded file:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i)) {
      setUploadError('Please upload a valid audio file format (MP3, WAV, M4A, OGG, AAC, FLAC, WEBM).');
      return;
    }

    if (file.size === 0) {
      setUploadError('Uploaded audio file is empty (0 bytes).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    console.log('[AudioUpload] Created object URL:', objectUrl);

    const uploaded: UploadedFile = {
      file,
      name: file.name,
      size: formatFileSize(file.size),
      bytes: file.size,
      url: objectUrl,
      duration: null,
      durationResolved: false,
    };

    setUploadedAudio(uploaded);
    setCaptureMode('audio_upload');

    // Auto-derive title if empty
    if (!title) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      setTitle(cleanName);
    }

    // Resolve duration accurately using HTMLAudioElement & WebM parser
    setIsResolvingDuration(true);
    const realDuration = await resolveAccurateAudioDuration(file, objectUrl);
    console.log('[AudioUpload] Resolved real audio duration:', realDuration);

    setUploadedAudio(prev => prev ? { ...prev, duration: realDuration, durationResolved: true } : null);
    setAudioDuration(realDuration);
    setIsResolvingDuration(false);
  };

  const handleVideoFile = async (file: File) => {
    if (!user) {
      onRequireAuth?.('record');
      return;
    }
    setUploadError(null);
    setValidationErrors(prev => ({ ...prev, video: undefined }));

    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setUploadError('Please upload a valid video file format (MP4, WEBM, MOV).');
      return;
    }

    if (file.size === 0) {
      setUploadError('Uploaded video file is empty (0 bytes).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const uploaded: UploadedFile = {
      file,
      name: file.name,
      size: formatFileSize(file.size),
      bytes: file.size,
      url: objectUrl,
      duration: null,
      durationResolved: false,
    };

    setUploadedVideo(uploaded);
    setCaptureMode('video');

    if (!title) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      setTitle(cleanName);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAudioFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Photo / Artifact File Selection
  const handlePhotoFiles = (files: FileList | null) => {
    if (!files) return;
    const newPhotos: { file: File; url: string; name: string }[] = [];
    Array.from(files).forEach(f => {
      if (f.type.startsWith('image/')) {
        newPhotos.push({
          file: f,
          url: URL.createObjectURL(f),
          name: f.name,
        });
      }
    });
    setUploadedPhotos(prev => [...prev, ...newPhotos]);
  };

  // Audio Playback Controls
  const togglePlayAudio = () => {
    if (!activeAudio) return;

    if (!previewAudioRef.current || previewAudioRef.current.src !== activeAudio.url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(activeAudio.url);
      audio.ontimeupdate = () => {
        setAudioCurrentTime(audio.currentTime);
      };
      audio.onended = () => {
        setAudioPlaying(false);
        setAudioCurrentTime(0);
      };
      audio.onerror = (e) => {
        console.error('[AudioPlayer] Playback error:', e, audio.error);
        setAudioPlaying(false);
      };
      previewAudioRef.current = audio;
      console.log('[AudioPlayer] Initialized player with URL:', activeAudio.url, 'readyState:', audio.readyState);
    }

    const player = previewAudioRef.current;
    if (audioPlaying) {
      player.pause();
      setAudioPlaying(false);
    } else {
      player.play()
        .then(() => {
          console.log('[AudioPlayer] Playback started successfully at', player.currentTime, 's. Duration:', player.duration);
          setAudioPlaying(true);
        })
        .catch(err => {
          console.error('[AudioPlayer] Play error:', err);
          setAudioPlaying(false);
        });
    }
  };

  const handleRemoveActiveAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (captureMode === 'audio_record') {
      setRecordedAudio(null);
    } else {
      setUploadedAudio(null);
    }
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(null);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      console.log('[DraftPersistence] Cleared recording draft from localStorage');
    } catch {
      // ignore
    }
  };

  // ============================================================
  // 2. MANDATORY VALIDATION GATES
  // ============================================================
  const validateStep1 = () => {
    if (captureMode === 'audio_record' || captureMode === 'audio_upload') {
      if (!activeAudio) {
        setValidationErrors({ audio: 'Please record voice lore with your microphone or upload an audio file to continue.' });
        return false;
      }
    } else if (captureMode === 'video') {
      if (!uploadedVideo) {
        setValidationErrors({ audio: 'Please upload a video file to continue.' });
        return false;
      }
    } else if (captureMode === 'text') {
      if (category === 'traditional_recipe' && (!recipeData.ingredients[0] || !recipeData.instructions[0])) {
        setValidationErrors({ audio: 'Please add at least one ingredient and instruction.' });
        return false;
      } else if (category !== 'traditional_recipe' && !writtenStory.trim()) {
        setValidationErrors({ audio: 'Please write your story or lore to continue.' });
        return false;
      }
    }
    // Photo mode requires no primary media in Step 1, but we assume they will upload in Step 2.
    setValidationErrors({});
    return true;
  };

  const validateStep2 = () => {
    const errors: typeof validationErrors = {};
    if (!title.trim()) errors.title = 'Please provide the Cultural Title / Lore Name.';
    if (!category) errors.category = 'Please select a cultural category.';
    if (!language.trim()) errors.language = 'Please provide the original language.';
    if (!state.trim()) errors.state = 'Please select the state or region.';

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }
    setValidationErrors({});
    return true;
  };

  // ============================================================
  // 3. SUBMISSION & REAL SHARED STORE SYNC
  // ============================================================
  const handleSubmit = async () => {
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    if (!user) {
      onRequireAuth?.('record');
      return;
    }

    setIsUploadingToSupabase(true);
    let finalAudioUrl = activeAudio?.url;

    if (captureMode === 'audio_record' || captureMode === 'audio_upload') {
      const audioPayload = activeAudio?.file ?? activeAudio?.blob;
      if (audioPayload) {
        try {
          const timestamp = Date.now();
          const ext = audioPayload.type.includes('ogg') ? 'ogg' : 'webm';
          const filePath = `users/${user.id}/voice_${timestamp}.${ext}`;
          
          const { error } = await supabase.storage.from('lore-audio').upload(filePath, audioPayload, {
            upsert: false,
            contentType: audioPayload.type || 'audio/webm',
          });
          
          if (!error) {
            const { data: publicUrlData } = supabase.storage.from('lore-audio').getPublicUrl(filePath);
            finalAudioUrl = publicUrlData.publicUrl;
          } else {
             console.error('[Supabase Storage] Upload error:', error.message);
          }
        } catch (err) {
          console.warn('[ContributeStudio] Supabase lore-audio upload notice:', err);
        }
      }
    }

    try {
      const { error } = await supabase.from('living_lore').insert({
        title: title.trim(),
        category,
        language: language.trim(),
        district: district.trim() || undefined,
        state: state.trim() || undefined,
        lat: coordinates ? coordinates[1] : null,
        lng: coordinates ? coordinates[0] : null,
        audio_url: finalAudioUrl,
        satya_score: 85,
        short_description: contextNotes.trim(),
        lifecycle_status: 'published'
      });
      
      if (error) {
        console.error('[Supabase] Insert Error:', error);
      } else {
        // Optimistic UI update: instantly add to store so map updates
        const newRecordId = editingDraftId || culturalStore.generateId();
        culturalStore.addContribution({
          id: newRecordId,
          title: title.trim(),
          category,
          mediaType: captureMode === 'audio_record' || captureMode === 'audio_upload' ? 'audio' : captureMode === 'video' ? 'video' : captureMode === 'photo' ? 'photo' : 'text',
          originalLanguage: language.trim(),
          state: state.trim(),
          district: district.trim() || undefined,
          fullDescription: contextNotes.trim() || `Field lore contributed in ${language} from ${state}.`,
          shortDescription: contextNotes.trim() ? contextNotes.slice(0, 140) + '...' : `Contribution: ${title} (${language}, ${state}).`,
          originalAudioUrl: finalAudioUrl,
          lifecycleStatus: 'published',
          contributor: user.email || 'Community Contributor',
          coordinates: coordinates ? { lat: coordinates[1], lng: coordinates[0] } : undefined,
          syncStatus: 'synced',
          verificationStatus: 'unverified'
        } as any, user.email, user.id);
      }
    } catch (err) {
       console.error('[Supabase] Error:', err);
    }

    setIsUploadingToSupabase(false);

    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }

    // Redirect to map to see new pin
    navigate('/map');
  };

  const handleSaveDraft = async () => {
    if (!user) {
      onRequireAuth?.('record');
      return;
    }

    if (!title.trim()) {
      setValidationErrors(prev => ({ ...prev, title: 'Please provide a cultural title for your draft.' }));
      setStep(2);
      return;
    }

    setIsUploadingToSupabase(true);
    let finalAudioUrl = activeAudio?.url;
    let finalVideoUrl = uploadedVideo?.url;

    if (captureMode === 'audio_record' || captureMode === 'audio_upload') {
      const audioPayload = activeAudio?.file ?? activeAudio?.blob;
      if (audioPayload) {
        try {
          const uploadedUrl = await uploadAudioRecording(audioPayload, 'draft_lore', user.id);
          if (uploadedUrl) {
            finalAudioUrl = uploadedUrl;
          }
        } catch (err) {
          console.warn('[ContributeStudio] Draft audio upload notice:', err);
        }
      }
    } else if (captureMode === 'video') {
      const videoPayload = uploadedVideo?.file;
      if (videoPayload) {
        try {
          const uploadedUrl = await uploadVideoFile(videoPayload, 'draft_lore_video', user.id);
          if (uploadedUrl) {
            finalVideoUrl = uploadedUrl;
          }
        } catch (err) {
          console.warn('[ContributeStudio] Draft video upload notice:', err);
        }
      }
    }

    setIsUploadingToSupabase(false);

    let finalFullDescription = contextNotes.trim();
    if (captureMode === 'text' && category !== 'traditional_recipe') {
      finalFullDescription = writtenStory.trim() + (finalFullDescription ? `\n\nContext Notes:\n${finalFullDescription}` : '');
    }

    const draftId = editingDraftId || culturalStore.generateId();
    culturalStore.addContribution({
      id: draftId,
      title: title.trim(),
      category,
      mediaType: captureMode === 'audio_record' || captureMode === 'audio_upload' ? 'audio' : captureMode === 'video' ? 'video' : captureMode === 'photo' ? 'photo' : 'text',
      originalLanguage: language.trim() || 'Hindi',
      dialect: dialect.trim() || undefined,
      state: state.trim() || 'Unspecified',
      district: district.trim() || undefined,
      village: village.trim() || undefined,
      community: community.trim() || undefined,
      knowledgeHolder: knowledgeHolder.trim() || undefined,
      fullDescription: finalFullDescription || `Draft field lore recorded by ${user.email}.`,
      shortDescription: contextNotes.trim() ? contextNotes.slice(0, 140) + '...' : `Draft: ${title}`,
      originalAudioUrl: captureMode === 'audio_record' || captureMode === 'audio_upload' ? finalAudioUrl : undefined,
      audioDuration: activeAudio?.duration ?? undefined,
      videoUrl: captureMode === 'video' ? finalVideoUrl : undefined,
      recipeDetails: captureMode === 'text' && category === 'traditional_recipe' ? recipeData : undefined,
      consentTier,
      syncStatus: 'synced',
      lifecycleStatus: 'draft',
      verificationStatus: 'unverified',
      images: uploadedPhotos.map(p => p.url),
      contributor: user.email || 'Community Contributor',
      coordinates: coordinates ? { lat: coordinates[1], lng: coordinates[0] } : undefined,
      externalReference: selectedReference ? {
        sourceName: selectedReference.sourceName,
        sourceUrl: selectedReference.sourceUrl,
        sourceIdentifier: selectedReference.sourceIdentifier,
        sourceType: selectedReference.sourceType,
        retrievedAt: selectedReference.retrievedAt
      } : undefined
    }, user.email, user.id);

    setEditingDraftId(null);
    setSyncingAllNotice('Draft saved securely. You can view, resume, edit, or delete it from "My Contributions & Drafts" below.');
    setTimeout(() => setSyncingAllNotice(null), 5000);
  };

  const handleResumeDraft = (draft: CulturalRecord) => {
    setEditingDraftId(draft.id);
    setTitle(draft.title || '');
    setCategory(draft.category || 'oral_story');
    setLanguage(draft.originalLanguage || '');
    setDialect(draft.dialect || '');
    setState(draft.state || '');
    setDistrict(draft.district || '');
    setVillage(draft.village || '');
    setCommunity(draft.community || '');
    setKnowledgeHolder(draft.knowledgeHolder || '');
    setContextNotes(draft.fullDescription || '');
    setConsentTier(draft.consentTier || 'public');
    
    if (draft.mediaType) {
      if (draft.mediaType === 'audio') {
        if (draft.originalAudioUrl) {
          setUploadedAudio({
            name: `${draft.title || 'Draft Audio'}.webm`,
            size: 'Draft Audio',
            url: draft.originalAudioUrl,
            duration: draft.audioDuration || null,
            durationResolved: true,
          });
          setCaptureMode('audio_upload');
        }
      } else if (draft.mediaType === 'video') {
        if (draft.videoUrl) {
          setUploadedVideo({
            name: `${draft.title || 'Draft Video'}.mp4`,
            size: 'Draft Video',
            url: draft.videoUrl,
            duration: null,
            durationResolved: false,
          });
          setCaptureMode('video');
        }
      } else if (draft.mediaType === 'text') {
        setCaptureMode('text');
        if (draft.category === 'traditional_recipe' && draft.recipeDetails) {
          setRecipeData(draft.recipeDetails);
        } else if (draft.fullDescription) {
          const notesSplit = draft.fullDescription.split('\n\nContext Notes:\n');
          setWrittenStory(notesSplit[0]);
          if (notesSplit.length > 1) {
            setContextNotes(notesSplit[1]);
          }
        }
      } else if (draft.mediaType === 'photo') {
        setCaptureMode('photo');
      }
    } else {
      // Legacy fallback
      if (draft.originalAudioUrl) {
        setUploadedAudio({
          name: `${draft.title || 'Draft Audio'}.webm`,
          size: 'Draft Audio',
          url: draft.originalAudioUrl,
          duration: draft.audioDuration || null,
          durationResolved: true,
        });
        setCaptureMode('audio_upload');
      }
    }
    setStep(2);
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const handleDeleteDraft = (id: string) => {
    culturalStore.deleteRecord(id);
    if (editingDraftId === id) {
      setEditingDraftId(null);
    }
    setSyncingAllNotice('Draft deleted successfully.');
    setTimeout(() => setSyncingAllNotice(null), 3000);
  };

  // Contributor Privacy: Filter queue to ONLY the authenticated user's records
  const contributionQueue = allStoreRecords.filter(r => {
    if (r.id.startsWith('ICH0') || r.id.startsWith('ICH-')) return false;
    if (!user) return false;
    return r.contributor === user.email || (r as any).user_id === user.id || (r as any).contributor_email === user.email;
  });

  const getContributorStatusInfo = (item: CulturalRecord) => {
    const status = item.lifecycleStatus || 'submitted';
    if (status === 'draft') {
      return {
        label: 'Draft',
        pillClass: 'sync-pill pending',
        message: 'Draft in progress. You can edit and submit whenever ready.',
      };
    }
    if (status === 'under_review') {
      return {
        label: 'Under Review',
        pillClass: 'sync-pill synced',
        message: 'Your contribution is currently under review.',
      };
    }
    if (status === 'verified' || status === 'published') {
      return {
        label: 'Verified & Published',
        pillClass: 'sync-pill synced',
        message: 'Your contribution has been verified and published.',
      };
    }
    if (status === 'rejected') {
      return {
        label: 'Rejected',
        pillClass: 'sync-pill pending',
        message: 'Submission not approved.',
      };
    }
    return {
      label: 'Submitted',
      pillClass: 'sync-pill synced',
      message: 'Your contribution has been submitted and registered into the national pipeline.',
    };
  };

  return (
    <div className="contribute-page page-enter" id="contribute-page">
      <div className="contribute-header">
        <div className="ornament">🎙️</div>
        <h2>{t('contribute.contribute')} - Field Studio</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto' }}>
          Preserve living traditions through real browser voice recordings or high-fidelity audio uploads with mandatory provenance attribution.
        </p>
      </div>

      {/* Guest / Authenticated Contributor Telemetry */}
      {!user ? (
        <div style={{
          maxWidth: '750px',
          margin: '0 auto var(--space-xl)',
          padding: '14px 20px',
          background: 'var(--surface-container)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>🔐</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                Sign In with Email to Record &amp; Save Living Lore
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Guest browsing active. Sign in to record microphone audio and save persistent records to the Supabase Cloud.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onRequireAuth?.('record')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Lock size={13} /> Sign In to Record
          </button>
        </div>
      ) : (
        <div style={{
          maxWidth: '750px',
          margin: '0 auto var(--space-lg)',
          padding: '8px 16px',
          background: 'var(--surface-container)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.76rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--emerald)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)' }} />
            <span>Contributor: <strong>{user.email}</strong></span>
          </div>
          <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>☁️ Supabase Cloud Storage Connected</span>
        </div>
      )}

      {isUploadingToSupabase && (
        <div style={{
          maxWidth: '750px',
          margin: '0 auto var(--space-md)',
          padding: '10px 16px',
          background: 'rgba(229, 195, 101, 0.12)',
          border: '1px solid rgba(229, 195, 101, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.8rem',
          color: '#E5C365',
          fontFamily: 'var(--font-mono)',
        }}>
          <CloudUpload size={16} className="animate-pulse" />
          <span>Uploading voice recording to Supabase Cloud Storage...</span>
        </div>
      )}

      {/* Step Indicators */}
      <div className="contribute-steps" id="contribute-steps">
        {[
          { num: 1, label: '1. Record / Upload Voice *' },
          { num: 2, label: '2. Mandatory Cultural Details *' },
          { num: 3, label: '3. Consent & Rights' },
        ].map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              className={`step-indicator ${step === s.num ? 'active' : step > s.num ? 'completed' : 'pending'}`}
              onClick={() => {
                if (s.num === 1) setStep(1);
                if (s.num === 2 && validateStep1()) setStep(2);
                if (s.num === 3 && validateStep1() && validateStep2()) setStep(3);
              }}
              style={{ cursor: 'pointer' }}
            >
              {step > s.num ? <Check size={14} /> : s.num}
              {s.label}
            </div>
            {i < 2 && <div className={`step-connector ${step > s.num ? 'completed' : ''}`} />}
          </div>
        ))}
      </div>

      {/* ============================================================
         STEP 1: MEDIA & CONTENT CAPTURE
         ============================================================ */}
      {step === 1 && (
        <div className="form-section" id="step-record">

          {/* External Knowledge Search Integration */}
          <div style={{
            marginBottom: 'var(--space-xl)',
            padding: '20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '8px', color: 'var(--slate)', fontSize: '1.1rem' }}>
              <Search size={18} style={{ color: 'var(--terracotta)' }} />
              Search Existing Heritage Knowledge
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Find related heritage information from trusted/open knowledge sources before creating your contribution.
            </p>

            {!selectedReference ? (
              <div>
                <div style={{ position: 'relative', maxWidth: '500px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search Wikipedia/Wikidata (e.g. 'Warli Painting')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '38px', paddingRight: '40px', width: '100%' }}
                  />
                  {isSearching && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      <RefreshCw size={16} className="animate-spin text-muted" />
                    </div>
                  )}
                  {searchQuery && !isSearching && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {searchResults.map(result => (
                      <div key={result.id} style={{ display: 'flex', gap: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.03)', alignItems: 'flex-start' }}>
                        {result.images && result.images.length > 0 && (
                          <img src={result.images[0]} alt={result.title} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: 'var(--slate)' }}>
                              {result.title}
                            </h4>
                            <span style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                              External Knowledge
                            </span>
                          </div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {result.shortDescription}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {result.coordinates && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} /> {result.coordinates[1].toFixed(2)}, {result.coordinates[0].toFixed(2)}
                              </span>
                            )}
                            <a href={result.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                              <ExternalLink size={12} /> Wikipedia • Wikidata
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setSelectedReference(result);
                            setSearchQuery('');
                            setSearchResults([]);
                            if (!title) setTitle(result.title);
                          }}
                        >
                          Use as Reference
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery && !isSearching && searchResults.length === 0 && (
                  <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No related external knowledge found.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px', border: '1px solid var(--terracotta)', borderRadius: 'var(--radius-md)', background: 'rgba(224, 109, 68, 0.05)', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReference(null)}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Remove Reference"
                >
                  <X size={18} />
                </button>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--terracotta)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  EXISTING KNOWLEDGE
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--slate)' }}>
                  {selectedReference.title}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Sources: <a href={selectedReference.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo)', textDecoration: 'none' }}>Wikipedia • Wikidata</a>
                  </span>
                  {selectedReference.coordinates && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> Suggested Location Available
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, color: 'var(--slate)', fontSize: '1.1rem' }}>
              YOUR CONTRIBUTION
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Tell us what you know. Record audio, add photos, or write your community story.
            </p>
          </div>

          <div className="capture-mode-tabs" style={{ flexWrap: 'wrap', gap: '8px', paddingBottom: '12px' }}>
            <button
              className={`mode-tab-btn ${captureMode === 'audio_record' ? 'active' : ''}`}
              onClick={() => { setCaptureMode('audio_record'); setValidationErrors({}); }}
            >
              <Mic size={16} /> Record Audio
            </button>
            <button
              className={`mode-tab-btn ${captureMode === 'audio_upload' ? 'active' : ''}`}
              onClick={() => { setCaptureMode('audio_upload'); setValidationErrors({}); }}
            >
              <Upload size={16} /> Upload Audio
            </button>
            <button
              className={`mode-tab-btn ${captureMode === 'video' ? 'active' : ''}`}
              onClick={() => { setCaptureMode('video'); setValidationErrors({}); }}
            >
              <Video size={16} /> Video
            </button>
            <button
              className={`mode-tab-btn ${captureMode === 'photo' ? 'active' : ''}`}
              onClick={() => { setCaptureMode('photo'); setValidationErrors({}); }}
            >
              <Image size={16} /> Photos Only
            </button>
            <button
              className={`mode-tab-btn ${captureMode === 'text' ? 'active' : ''}`}
              onClick={() => { setCaptureMode('text'); setValidationErrors({}); }}
            >
              <FileText size={16} /> Text / Recipe
            </button>
          </div>

          {/* Validation Alert for Audio */}
          {validationErrors.audio && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(140, 59, 59, 0.08)',
              border: '1.5px solid var(--madder)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--madder)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: 'var(--space-md)'
            }}>
              <AlertCircle size={16} /> {validationErrors.audio}
            </div>
          )}

          {/* Microphone Permission Error */}
          {micPermissionError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(217, 164, 65, 0.12)',
              border: '1.5px solid var(--turmeric)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--slate)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: 'var(--space-md)'
            }}>
              <AlertCircle size={16} style={{ color: 'var(--turmeric-dark)', flexShrink: 0 }} />
              <div>{micPermissionError}</div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={audioFileInputRef}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                handleAudioFile(e.target.files[0]);
              }
            }}
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm"
            style={{ display: 'none' }}
          />

          {/* ============================================================
             MODE A: LIVE MEDIARECORDER
             ============================================================ */}
          {captureMode === 'audio_record' && (
            <div>
              {!recordedAudio ? (
                <div className="voice-recorder" id="voice-recorder-box">
                  {/* Big Circular Microphone Recording Button */}
                  <button
                    className={`mic-button record-btn ${isRecording ? 'recording' : 'idle'}`}
                    onClick={isRecording ? stopRealRecording : startRealRecording}
                    id="mic-record-btn"
                    title={isRecording ? 'Click to stop recording' : 'Click to start microphone recording'}
                    type="button"
                  >
                    {isRecording ? <Square size={36} style={{ color: '#ffffff' }} /> : <Mic size={42} style={{ color: '#ffffff' }} />}
                  </button>

                  {/* Clear Action Button */}
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    {isRecording ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={stopRealRecording}
                        style={{
                          background: 'var(--madder)',
                          borderColor: 'var(--madder)',
                          color: '#ffffff',
                          fontWeight: 700,
                          padding: '10px 24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                        }}
                      >
                        <Square size={18} /> Stop & Preserve Recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={startRealRecording}
                        style={{
                          background: 'var(--terracotta)',
                          borderColor: 'var(--terracotta)',
                          color: '#ffffff',
                          fontWeight: 700,
                          padding: '10px 24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(180, 85, 44, 0.4)',
                        }}
                      >
                        <Mic size={18} /> Click to Start Voice Recording
                      </button>
                    )}
                  </div>

                  <div className="recording-status recorder-label">
                    {isRecording ? (
                      <span style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite' }} />
                        Recording Microphone ({formatTime(recordingTime)}) — Speak your living lore
                      </span>
                    ) : (
                      <span style={{ color: '#f8f5ee' }}>
                        Press the microphone button above to record voice lore directly from your browser
                      </span>
                    )}
                  </div>

                  <div className="waveform-display recorder-visualizer">
                    {recorderBars.map((h, i) => (
                      <div
                        key={i}
                        className={`bar ${isRecording ? 'active' : ''}`}
                        style={{ height: `${isRecording ? h : 10}%` }}
                      />
                    ))}
                  </div>

                  <div className="time-display recorder-time">{formatTime(recordingTime)}</div>

                  {!isRecording && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--turmeric-light)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(217, 164, 65, 0.3)',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-round)',
                        }}
                        onClick={() => handleAttachDemoSample('Oral Field Lore Sample')}
                      >
                        🎙️ Or load a sample field voice recording (Instant 1-Click Demo)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Recorded Audio Playback Card */
                <div className="uploaded-audio-preview" id="recorded-audio-preview">
                  <div className="audio-icon-box">
                    <FileAudio size={28} />
                  </div>
                  <div className="audio-details">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: 'rgba(107, 142, 111, 0.2)', color: 'var(--sage-dark)', fontWeight: 800, fontSize: '0.76rem', letterSpacing: '0.5px' }}>
                        🎙 AUDIO CAPTURED
                      </span>
                      {isResolvingDuration && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--turmeric-dark)', fontWeight: 600 }}>
                          Measuring exact duration...
                        </span>
                      )}
                    </div>
                    <div className="file-name" style={{ marginTop: '4px', fontWeight: 700 }}>{recordedAudio.name}</div>
                    <div className="file-meta" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {recordedAudio.duration !== null && Number.isFinite(recordedAudio.duration) ? (
                        <>
                          <strong style={{ color: 'var(--slate)' }}>Duration:</strong> {formatAudioDuration(recordedAudio.duration)} · <strong style={{ color: 'var(--slate)' }}>Size:</strong> {recordedAudio.size}
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--turmeric-dark)', fontWeight: 600 }}>Audio captured — duration unavailable</span> · <strong style={{ color: 'var(--slate)' }}>Size:</strong> {recordedAudio.size}
                        </>
                      )}
                    </div>

                    <div className="audio-scrubber-row" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button className="play-toggle-btn" onClick={togglePlayAudio} title={audioPlaying ? 'Pause' : 'Play Recording'}>
                        {audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: audioPlaying ? 'var(--terracotta)' : 'var(--slate)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {audioPlaying ? 'Playing Voice Lore' : '▶ Play Recording'}
                      </button>
                      <div className="scrubber-track" style={{ flex: 1 }}>
                        <div
                          className="scrubber-fill"
                          style={{
                            width: `${
                              currentAudioDuration && currentAudioDuration > 0
                                ? Math.min(100, (audioCurrentTime / currentAudioDuration) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="scrubber-time" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {formatPlaybackTime(audioCurrentTime)} / {formatAudioDuration(currentAudioDuration)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      className="remove-btn"
                      onClick={handleReRecord}
                      title="Re-record from microphone"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', color: 'var(--terracotta)' }}
                    >
                      <RefreshCw size={14} /> Re-record
                    </button>
                    <button
                      className="remove-btn"
                      onClick={handleRemoveActiveAudio}
                      title="Delete recording"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================
             MODE B: AUDIO FILE UPLOAD
             ============================================================ */}
          {captureMode === 'audio_upload' && (
            <div>
              {!uploadedAudio ? (
                <div
                  className={`audio-dropzone ${isDragging ? 'dragover' : ''}`}
                  id="audio-upload-dropzone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => audioFileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <Upload size={36} />
                  </div>
                  <h4>Drag and drop high-quality audio here</h4>
                  <p>Supports MP3, WAV, M4A, OGG, AAC, FLAC, WEBM up to 100MB</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); audioFileInputRef.current?.click(); }}
                    >
                      Browse Local Audio Files
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleAttachDemoSample('Archival Field Recording'); }}
                    >
                      🎵 Attach Sample Audio (Demo)
                    </button>
                  </div>
                </div>
              ) : (
                /* Uploaded Audio Preview Card */
                <div className="uploaded-audio-preview" id="uploaded-audio-preview">
                  <div className="audio-icon-box">
                    <FileAudio size={28} />
                  </div>
                  <div className="audio-details">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: 'rgba(43, 58, 85, 0.1)', color: 'var(--indigo)', fontWeight: 800, fontSize: '0.76rem', letterSpacing: '0.5px' }}>
                        🎙 AUDIO CAPTURED
                      </span>
                      {isResolvingDuration && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--turmeric-dark)', fontWeight: 600 }}>
                          Measuring exact duration...
                        </span>
                      )}
                    </div>
                    <div className="file-name" style={{ marginTop: '4px', fontWeight: 700 }}>{uploadedAudio.name}</div>
                    <div className="file-meta" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {uploadedAudio.duration !== null && Number.isFinite(uploadedAudio.duration) ? (
                        <>
                          <strong style={{ color: 'var(--slate)' }}>Duration:</strong> {formatAudioDuration(uploadedAudio.duration)} · <strong style={{ color: 'var(--slate)' }}>Size:</strong> {uploadedAudio.size}
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--turmeric-dark)', fontWeight: 600 }}>Audio captured — duration unavailable</span> · <strong style={{ color: 'var(--slate)' }}>Size:</strong> {uploadedAudio.size}
                        </>
                      )}
                    </div>
                    <div className="audio-scrubber-row" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button className="play-toggle-btn" onClick={togglePlayAudio} title={audioPlaying ? 'Pause' : 'Play Recording'}>
                        {audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: audioPlaying ? 'var(--terracotta)' : 'var(--slate)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {audioPlaying ? 'Playing Voice Lore' : '▶ Play Recording'}
                      </button>
                      <div className="scrubber-track" style={{ flex: 1 }}>
                        <div
                          className="scrubber-fill"
                          style={{
                            width: `${
                              uploadedAudio.duration && uploadedAudio.duration > 0
                                ? Math.min(100, (audioCurrentTime / uploadedAudio.duration) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="scrubber-time" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {formatPlaybackTime(audioCurrentTime)} / {formatAudioDuration(uploadedAudio.duration)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="remove-btn"
                    onClick={handleRemoveActiveAudio}
                    title="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}

              {uploadError && (
                <div style={{ color: 'var(--madder)', fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>
                  ⚠️ {uploadError}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
             MODE C: VIDEO UPLOAD
             ============================================================ */}
          {captureMode === 'video' && (
            <div>
              <input
                type="file"
                ref={videoFileInputRef}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleVideoFile(e.target.files[0]);
                  }
                }}
                accept="video/*,.mp4,.webm,.mov,.mkv"
                style={{ display: 'none' }}
              />
              {!uploadedVideo ? (
                <div
                  className={`audio-dropzone ${isDragging ? 'dragover' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleVideoFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => videoFileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <Video size={36} />
                  </div>
                  <h4>Drag and drop high-quality video here</h4>
                  <p>Supports MP4, WEBM, MOV up to 100MB</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); videoFileInputRef.current?.click(); }}
                    >
                      Browse Local Video Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="uploaded-audio-preview" style={{ alignItems: 'flex-start' }}>
                  <div className="audio-icon-box">
                    <Video size={28} />
                  </div>
                  <div className="audio-details" style={{ width: '100%' }}>
                    <div className="file-name" style={{ marginTop: '4px', fontWeight: 700 }}>{uploadedVideo.name}</div>
                    <div className="file-meta" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--slate)' }}>Size:</strong> {uploadedVideo.size}
                    </div>
                    <video 
                      src={uploadedVideo.url} 
                      controls 
                      style={{ width: '100%', maxHeight: '300px', marginTop: '10px', borderRadius: '8px', background: '#000' }} 
                    />
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => { setUploadedVideo(null); setCaptureMode('video'); }}
                    title="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
              {uploadError && (
                <div style={{ color: 'var(--madder)', fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>
                  ⚠️ {uploadError}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
             MODE D: TEXT / RECIPE
             ============================================================ */}
          {captureMode === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group full-width">
                <label className="label">Category Selection</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="textCat" checked={category === 'oral_story'} onChange={() => setCategory('oral_story')} />
                    Written Story / Lore
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="textCat" checked={category === 'traditional_recipe'} onChange={() => setCategory('traditional_recipe')} />
                    Traditional Recipe
                  </label>
                </div>
              </div>

              {category === 'traditional_recipe' ? (
                <>
                  <div className="form-group full-width">
                    <label className="label">Preparation Time</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g., 45 minutes"
                      value={recipeData.preparationTime}
                      onChange={e => setRecipeData({ ...recipeData, preparationTime: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="label">Ingredients (One per line)</label>
                    <textarea
                      className="textarea"
                      placeholder="e.g., 2 cups Rice\n1 tsp Turmeric"
                      rows={5}
                      value={recipeData.ingredients.join('\n')}
                      onChange={e => setRecipeData({ ...recipeData, ingredients: e.target.value.split('\n') })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="label">Instructions (One step per line)</label>
                    <textarea
                      className="textarea"
                      placeholder="e.g., Step 1: Wash the rice..."
                      rows={6}
                      value={recipeData.instructions.join('\n')}
                      onChange={e => setRecipeData({ ...recipeData, instructions: e.target.value.split('\n') })}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group full-width">
                  <label className="label">Write your Story or Lore</label>
                  <textarea
                    className="textarea"
                    placeholder="Once upon a time..."
                    rows={10}
                    value={writtenStory}
                    onChange={e => setWrittenStory(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ============================================================
             MODE E: PHOTOS ONLY
             ============================================================ */}
          {captureMode === 'photo' && (
            <div>
              <div style={{ background: 'rgba(107, 142, 111, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(107, 142, 111, 0.3)' }}>
                <p style={{ color: 'var(--sage-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Image size={20} />
                  <strong>Photos Only Mode:</strong> You can skip audio/video and upload images directly in Step 2.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-xl)' }}>
            <button
              className="btn btn-primary"
              id="step1-next-btn"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              Next: Cultural Details →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
         STEP 2: MANDATORY MINIMUM CULTURAL DETAILS
         ============================================================ */}
      {step === 2 && (
        <div className="form-section" id="step-details">
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Mandatory Cultural Metadata & Context</h3>

          {/* Form Grid */}
          <div className="form-grid">
            {/* Title (Mandatory) */}
            <div className="form-group full-width">
              <label className="label">
                Cultural Title / Lore Name <span style={{ color: 'var(--madder)' }}>*</span>
              </label>
              <input
                className={`input ${validationErrors.title ? 'input-error' : ''}`}
                value={title}
                onChange={e => { setTitle(e.target.value); setValidationErrors(p => ({ ...p, title: undefined })); }}
                placeholder="e.g., Baul Dehatatva Lore, Warli Tarpa Ritual Song"
                required
              />
              {validationErrors.title && (
                <span className="error-text" style={{ color: 'var(--madder)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  ⚠️ {validationErrors.title}
                </span>
              )}
            </div>

            {/* Category (Mandatory) */}
            <div className="form-group">
              <label className="label">
                Cultural Domain / Category <span style={{ color: 'var(--madder)' }}>*</span>
              </label>
              <select
                className="select"
                value={category}
                onChange={e => setCategory(e.target.value as RecordCategory)}
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.emoji} {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Original Language (Mandatory) */}
            <div className="form-group">
              <label className="label">
                Original Language <span style={{ color: 'var(--madder)' }}>*</span>
              </label>
              <input
                className={`input ${validationErrors.language ? 'input-error' : ''}`}
                value={language}
                onChange={e => { setLanguage(e.target.value); setValidationErrors(p => ({ ...p, language: undefined })); }}
                placeholder="e.g., Bengali, Marathi, Santhali, Gondi"
                required
              />
              {validationErrors.language && (
                <span className="error-text" style={{ color: 'var(--madder)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  ⚠️ {validationErrors.language}
                </span>
              )}
            </div>

            {/* Dialect (Optional) */}
            <div className="form-group">
              <label className="label">Dialect / Variant (Optional)</label>
              <input
                className="input"
                value={dialect}
                onChange={e => setDialect(e.target.value)}
                placeholder="e.g., Rarhi, Varhadi, Malwi"
              />
            </div>

            {/* State (Mandatory) */}
            <div className="form-group">
              <label className="label">
                State / Region <span style={{ color: 'var(--madder)' }}>*</span>
              </label>
              <select
                className={`select ${validationErrors.state ? 'input-error' : ''}`}
                value={state}
                onChange={e => { setState(e.target.value); setValidationErrors(p => ({ ...p, state: undefined })); }}
              >
                <option value="">-- Select State / UT --</option>
                {[
                  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
                  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
                  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
                  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
                  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
                  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Jammu & Kashmir', 'Ladakh'
                ].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {validationErrors.state && (
                <span className="error-text" style={{ color: 'var(--madder)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  ⚠️ {validationErrors.state}
                </span>
              )}
            </div>

            {/* District / Village (Optional) */}
            <div className="form-group">
              <label className="label">District / Village (Optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  className="input"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="District (e.g. Birbhum)"
                />
                <input
                  className="input"
                  value={village}
                  onChange={e => setVillage(e.target.value)}
                  placeholder="Village (e.g. Kenduli)"
                />
              </div>
              
              {/* Wikidata Coordinates suggestion */}
              {selectedReference && selectedReference.coordinates && !coordinates && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(45, 212, 191, 0.08)', border: '1px solid rgba(45, 212, 191, 0.25)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--slate)' }}>
                    <MapPin size={16} style={{ color: 'var(--turmeric)' }} />
                    <span>Suggested Location from Wikidata: <strong>{selectedReference.coordinates[1].toFixed(4)}, {selectedReference.coordinates[0].toFixed(4)}</strong></span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ marginTop: '8px' }}
                    onClick={() => setCoordinates(selectedReference.coordinates)}
                  >
                    Confirm Suggested Location
                  </button>
                </div>
              )}
              {coordinates && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(107, 142, 111, 0.1)', border: '1px solid var(--sage)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--sage-dark)' }}>
                    ✓ Confirmed Coordinates: {coordinates[1].toFixed(4)}, {coordinates[0].toFixed(4)}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCoordinates(null)}>
                    <X size={14} /> Remove
                  </button>
                </div>
              )}
            </div>

            {/* Community / Practitioner (Optional) */}
            <div className="form-group">
              <label className="label">Community / Knowledge Holder (Optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  className="input"
                  value={community}
                  onChange={e => setCommunity(e.target.value)}
                  placeholder="Community (e.g. Baul community)"
                />
                <input
                  className="input"
                  value={knowledgeHolder}
                  onChange={e => setKnowledgeHolder(e.target.value)}
                  placeholder="Practitioner / Singer Name"
                />
              </div>
            </div>

            {/* Context & Transmission Notes (Optional) */}
            <div className="form-group full-width">
              <label className="label">Context, Occasion & Transmission Notes (Optional)</label>
              <textarea
                className="textarea"
                value={contextNotes}
                onChange={e => setContextNotes(e.target.value)}
                placeholder="Describe the occasion (e.g., harvest festival, night vigil), meaning, and generational lineage of this practice..."
                style={{ minHeight: '80px' }}
              />
            </div>
          </div>

          {/* Photo attachments */}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <label className="label">Supporting Photographs / Field Images (Optional)</label>
            <input
              type="file"
              ref={photoFileInputRef}
              onChange={e => handlePhotoFiles(e.target.files)}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => photoFileInputRef.current?.click()}
            >
              <Image size={14} /> Add Photos ({uploadedPhotos.length})
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-xl)', flexWrap: 'wrap', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back to Audio
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                disabled={isUploadingToSupabase}
                title="Save draft to continue later"
              >
                💾 {isUploadingToSupabase ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                className="btn btn-primary"
                id="step2-next-btn"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
              >
                Next: Consent & Rights →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
         STEP 3: CONSENT & RIGHTS
         ============================================================ */}
      {step === 3 && (
        <div className="form-section" id="step-consent">
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Free, Prior & Informed Consent</h3>

          <div className="consent-cards">
            {Object.entries(CONSENT_CONFIG).map(([key, config]) => (
              <label
                key={key}
                className={`consent-card ${consentTier === key ? 'selected' : ''}`}
                onClick={() => setConsentTier(key as ConsentTier)}
              >
                <input
                  type="radio"
                  name="consentTier"
                  value={key}
                  checked={consentTier === key}
                  onChange={() => setConsentTier(key as ConsentTier)}
                  style={{ display: 'none' }}
                />
                <div className="consent-card-radio">
                  <div className="consent-card-radio-inner" />
                </div>
                <div className="icon">{config.icon}</div>
                <div className="info">
                  <h4>{config.label}</h4>
                  <p>{config.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-xl)', flexWrap: 'wrap', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              ← Back to Details
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                disabled={isUploadingToSupabase}
                title="Save draft to continue later"
              >
                💾 {isUploadingToSupabase ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                className="btn btn-primary btn-lg"
                id="submit-contribution-btn"
                onClick={handleSubmit}
                disabled={isUploadingToSupabase}
              >
                <Check size={18} /> {isUploadingToSupabase ? 'Submitting...' : 'Submit Contribution to National Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
         MY CONTRIBUTIONS & DRAFTS (CONTRIBUTOR-ISOLATED)
         ============================================================ */}
      <div className="pending-queue" id="pending-queue" style={{ marginTop: 'var(--space-2xl)' }}>
        <div className="queue-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} />
            <h3 style={{ margin: 0 }}>My Contributions &amp; Saved Drafts</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user && (
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Author: {user.email}
              </span>
            )}
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={async () => {
                setSyncingAllNotice('Synchronizing local records to Supabase Cloud...');
                const count = await culturalStore.syncAllLocalToSupabase();
                setSyncingAllNotice(`Synchronized ${count} record(s) to Supabase Cloud!`);
                setTimeout(() => setSyncingAllNotice(null), 4000);
              }}
              id="sync-all-to-supabase-btn"
            >
              <CloudUpload size={13} /> Sync Cloud
            </button>
          </div>
        </div>

        {syncingAllNotice && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(45, 212, 191, 0.12)',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#5EEAD4',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Check size={14} />
            <span>{syncingAllNotice}</span>
          </div>
        )}

        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
          Track the status of your submissions or resume editing saved drafts. Internal reviewer notes and deliberation remain confidential.
        </p>

        {contributionQueue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
            {user ? 'You have no saved drafts or submissions yet. Record voice lore above to create one.' : 'Please sign in to view your personal submissions and drafts.'}
          </div>
        ) : (
          <div className="queue-items">
            {contributionQueue.map(item => {
              const statusInfo = getContributorStatusInfo(item);
              const isDraft = item.lifecycleStatus === 'draft';

              return (
                <div key={item.id} className="queue-item" id={`queue-item-${item.id}`}>
                  <div className="item-icon">
                    {item.originalAudioUrl ? '🎙️' : '📝'}
                  </div>
                  <div className="item-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--terracotta)', fontSize: '0.82rem' }}>
                        {item.id}
                      </span>
                      <h4>{item.title}</h4>
                      <span className={statusInfo.pillClass} style={{ fontSize: '0.7rem' }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="meta" style={{ marginTop: '3px' }}>
                      {CATEGORY_CONFIG[item.category]?.label || item.category} · {item.state} ({item.originalLanguage})
                    </div>
                    {/* Safe Contributor-Facing Status Notice */}
                    <div style={{ fontSize: '0.78rem', color: isDraft ? 'var(--turmeric-light)' : 'var(--sage-light)', marginTop: '4px', fontStyle: 'italic' }}>
                      ℹ️ {statusInfo.message}
                    </div>
                  </div>

                  <div className="item-status" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isDraft ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleResumeDraft(item)}
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        >
                          ✏️ Edit Draft
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleDeleteDraft(item.id)}
                          style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#F87171' }}
                          title="Delete draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Registered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
