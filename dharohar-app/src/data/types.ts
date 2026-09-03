/* ============================================================
   Cultural Record — Core Data Types
   Based on PRD Section 6: Cultural Record — Core Data Object
   ============================================================ */

export type RecordCategory =
  | 'oral_story'
  | 'folk_song'
  | 'traditional_recipe'
  | 'craft_weave'
  | 'ritual_tradition'
  | 'heritage_site';

export type ConsentTier = 'public' | 'community_only' | 'sacred_restricted';

export type VerificationStatus =
  | 'source_supported'
  | 'community_verified'
  | 'oral_tradition'
  | 'unverified'
  | 'conflicting_disputed';

export type ClaimStatus =
  | 'supported'
  | 'conflicting'
  | 'unverified'
  | 'oral_tradition';

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  evidenceIds: string[];
  reviewerNote?: string;
}

export interface GeminiClaim {
  claim: string;
  claimType: string;
  evidenceNeeded: boolean;
  status: 'Source-supported' | 'Community-verified' | 'Oral-tradition' | 'Unverified' | 'Conflicting';
  reasoning: string;
}

export interface GeminiCulturalAnalysis {
  language: string;
  title: string;
  category: string;
  state: string;
  district: string;
  community: string;
  people: string[];
  culturalPractices: string[];
  summary: string;
  keywords: string[];
  claims: GeminiClaim[];
}

export interface Evidence {
  id: string;
  sourceName: string;
  sourceType: 'government' | 'archival' | 'academic' | 'community';
  authority: string;
  reference: string;
  date?: string;
  region?: string;
  supportsClaim: string;
  accessNote?: string;
}

export type LifecycleStatus =
  | 'draft'
  | 'submitted'
  | 'recorded'
  | 'queued'
  | 'synced'
  | 'contributed'
  | 'ai_processing'
  | 'evidence_needed'
  | 'under_review'
  | 'verified'
  | 'published'
  | 'rejected'
  | 'conflicting';

export interface ProvenanceEvent {
  stage: 'contributed' | 'ai_processing' | 'evidence_added' | 'under_review' | 'verified' | 'published' | 'rejected' | 'draft' | 'recorded' | 'queued' | 'synced';
  title: string;
  actor: string;
  date: string;
  details: string;
  completed: boolean;
  current?: boolean;
}

export interface OriginalContribution {
  text?: string;
  contributor: string;
  recordingDate: string;
  mediaUrl?: string;
  audioFileName?: string;
  audioDuration?: number;
  videoUrl?: string;
  recipeDetails?: { ingredients: string[]; instructions: string[]; preparationTime?: string };
  consentTier: ConsentTier;
  rightsStatement?: string;
  location?: { state: string; district?: string; village?: string; coordinates?: { lat: number; lng: number } };
}

export interface AiAssistedFields {
  detectedLanguage?: string;
  suggestedCategory?: string;
  summary?: string;
  extractedEntities?: string[];
  extractedClaims?: GeminiClaim[];
  suggestedEvidenceRequirements?: string[];
  modelUsed?: string;
  processedAt?: string;
}

export interface ReviewerDecision {
  reviewerName: string;
  decisionDate: string;
  verdict: 'verified' | 'evidence_needed' | 'rejected' | 'conflicting';
  notes: string;
  claimDecisions?: { claimId: string; status: ClaimStatus; note?: string }[];
}

export interface CulturalRecord {
  id: string;
  title: string;
  nativeTitle?: string;
  category: RecordCategory;
  mediaType?: 'audio' | 'video' | 'photo' | 'text';
  shortDescription: string;
  fullDescription: string;

  /* Lifecycle & Provenance */
  lifecycleStatus?: LifecycleStatus;
  provenanceTimeline?: ProvenanceEvent[];
  originalContribution?: OriginalContribution;
  aiAssistedFields?: AiAssistedFields;
  reviewerDecision?: ReviewerDecision;

  /* Media & Audio Preserved */
  originalAudioUrl?: string; // Blob or Data URL or asset path
  audioDuration?: number;
  audioScript?: string;      // Text for TTS / demo audio
  videoUrl?: string;
  recipeDetails?: { ingredients: string[]; instructions: string[]; preparationTime?: string };
  transcriptOriginal?: string;
  transcriptEnglish?: string;
  images?: string[];

  /* Geography */
  state: string;
  district?: string;
  village?: string;
  coordinates?: { lat: number; lng: number };

  /* Language */
  originalLanguage: string;
  dialect?: string;
  translationLanguages?: string[];

  /* People */
  contributor: string;
  knowledgeHolder?: string;
  community?: string;
  collector?: string;

  /* Context */
  context?: string;
  festival?: string;
  practiceNotes?: string;

  /* Provenance */
  sourceType?: string;
  sourceReference?: string;
  recordingDate: string;
  externalReference?: {
    sourceName: string;
    sourceUrl: string;
    sourceIdentifier?: string;
    sourceType: string;
    retrievedAt: string;
  };

  /* Consent & Verification */
  consentTier: ConsentTier;
  verificationStatus: VerificationStatus;
  claims?: Claim[];

  /* Preservation */
  isEndangered?: boolean;
  preservationNote?: string;

  /* Sync */
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface TrustedSource {
  id: string;
  name: string;
  authority: string;
  sourceType: 'government' | 'archival' | 'academic' | 'community';
  region?: string;
  reference: string;
  date?: string;
  relevantClaim: string;
  accessNote?: string;
}

export interface ReviewAction {
  id: string;
  recordId: string;
  reviewerName: string;
  action: 'approve_community' | 'approve_source' | 'classify_oral' | 'request_clarification' | 'reject';
  notes: string;
  timestamp: string;
}

/* Category labels and icons */
export const CATEGORY_CONFIG: Record<RecordCategory, { label: string; emoji: string; color: string }> = {
  oral_story: { label: 'Oral Story', emoji: '📖', color: 'var(--terracotta)' },
  folk_song: { label: 'Folk Song', emoji: '🎵', color: 'var(--indigo)' },
  traditional_recipe: { label: 'Traditional Recipe', emoji: '🍲', color: 'var(--turmeric)' },
  craft_weave: { label: 'Craft & Weave', emoji: '🧵', color: 'var(--sage)' },
  ritual_tradition: { label: 'Ritual & Tradition', emoji: '🪔', color: 'var(--madder)' },
  heritage_site: { label: 'Heritage Site', emoji: '🏛️', color: 'var(--indigo-light)' },
};

export const VERIFICATION_CONFIG: Record<VerificationStatus, { label: string; badgeClass: string; description: string }> = {
  source_supported: {
    label: 'Source-Supported',
    badgeClass: 'badge-verified',
    description: 'Supported by trusted documentary/official/academic source',
  },
  community_verified: {
    label: 'Community-Verified',
    badgeClass: 'badge-community',
    description: 'Reviewed and verified by community members',
  },
  oral_tradition: {
    label: 'Oral Tradition',
    badgeClass: 'badge-oral',
    description: 'Preserved as oral/community tradition',
  },
  unverified: {
    label: 'Unverified',
    badgeClass: 'badge-unverified',
    description: 'Insufficient evidence or review available',
  },
  conflicting_disputed: {
    label: 'Disputed',
    badgeClass: 'badge-disputed',
    description: 'Sources or accounts disagree',
  },
};

export const CONSENT_CONFIG: Record<ConsentTier, { label: string; description: string; icon: string }> = {
  public: {
    label: 'Public',
    description: 'Discoverable by all users',
    icon: '🌐',
  },
  community_only: {
    label: 'Community Only',
    description: 'Visible only to authorized community members',
    icon: '👥',
  },
  sacred_restricted: {
    label: 'Sacred / Restricted',
    description: 'Never exposed outside consented audience',
    icon: '🔒',
  },
};

/* Indian states for the map */
export const INDIAN_STATES: { name: string; id: string; recordCount: number }[] = [
  { name: 'Andhra Pradesh', id: 'AP', recordCount: 3 },
  { name: 'Arunachal Pradesh', id: 'AR', recordCount: 1 },
  { name: 'Assam', id: 'AS', recordCount: 5 },
  { name: 'Bihar', id: 'BR', recordCount: 2 },
  { name: 'Chhattisgarh', id: 'CG', recordCount: 2 },
  { name: 'Delhi', id: 'DL', recordCount: 1 },
  { name: 'Goa', id: 'GA', recordCount: 1 },
  { name: 'Gujarat', id: 'GJ', recordCount: 4 },
  { name: 'Haryana', id: 'HR', recordCount: 1 },
  { name: 'Himachal Pradesh', id: 'HP', recordCount: 2 },
  { name: 'Jammu & Kashmir', id: 'JK', recordCount: 2 },
  { name: 'Jharkhand', id: 'JH', recordCount: 1 },
  { name: 'Karnataka', id: 'KA', recordCount: 3 },
  { name: 'Kerala', id: 'KL', recordCount: 4 },
  { name: 'Ladakh', id: 'LA', recordCount: 2 },
  { name: 'Madhya Pradesh', id: 'MP', recordCount: 3 },
  { name: 'Maharashtra', id: 'MH', recordCount: 5 },
  { name: 'Manipur', id: 'MN', recordCount: 1 },
  { name: 'Meghalaya', id: 'ML', recordCount: 1 },
  { name: 'Mizoram', id: 'MZ', recordCount: 1 },
  { name: 'Nagaland', id: 'NL', recordCount: 1 },
  { name: 'Odisha', id: 'OD', recordCount: 3 },
  { name: 'Punjab', id: 'PB', recordCount: 2 },
  { name: 'Rajasthan', id: 'RJ', recordCount: 6 },
  { name: 'Sikkim', id: 'SK', recordCount: 1 },
  { name: 'Tamil Nadu', id: 'TN', recordCount: 4 },
  { name: 'Telangana', id: 'TS', recordCount: 2 },
  { name: 'Tripura', id: 'TR', recordCount: 1 },
  { name: 'Uttar Pradesh', id: 'UP', recordCount: 3 },
  { name: 'Uttarakhand', id: 'UK', recordCount: 3 },
  { name: 'West Bengal', id: 'WB', recordCount: 5 },
];
