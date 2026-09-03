/* ============================================================
   Dharohar Setu — Unified Cultural Record Store & Lifecycle Engine
   Single Source of Truth across Contribution, AI Pipeline,
   Verification, Reviewer, Cultural Atlas, and Heritage Map.
   ============================================================ */

import { useState, useEffect } from 'react';
import type { CulturalRecord, LifecycleStatus, ClaimStatus, Evidence, GeminiCulturalAnalysis } from './types';
import { culturalRecords as initialSeedRecords, evidenceRegistry } from './seedData';
import {
  saveContributionToSupabase,
  fetchContributionsFromSupabase,
  deleteContributionFromSupabase
} from '../services/supabaseClient';

const STORAGE_KEY = 'dharohar_unified_cultural_records_v1';

type Listener = (records: CulturalRecord[]) => void;

class CulturalRecordStore {
  private records: CulturalRecord[] = [];
  private listeners: Set<Listener> = new Set();
  private nextIdCounter: number = 21;

  constructor() {
    this.initStore();
    this.initSupabaseSync();
  }

  private initStore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CulturalRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.records = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using seed records:', e);
    }

    // Default initialization from seedData
    this.records = [...initialSeedRecords];
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.warn('Could not write to localStorage:', e);
    }
    this.notify();
  }

  private notify() {
    const copy = [...this.records];
    this.listeners.forEach(l => l(copy));
  }

  /**
   * Initializes real-time synchronization with Supabase Database
   */
  public async initSupabaseSync() {
    try {
      const remote = await fetchContributionsFromSupabase();
      if (remote && remote.length > 0) {
        const recordMap = new Map<string, CulturalRecord>();
        // Load initial records
        this.records.forEach(r => recordMap.set(r.id, r));
        // Remote contributions take precedence / augment
        remote.forEach(r => recordMap.set(r.id, r));
        this.records = Array.from(recordMap.values());
        this.saveToStorage();
        console.log(`[CulturalStore] Loaded ${remote.length} contributions from Supabase DB.`);
      }
    } catch (e) {
      console.warn('[CulturalStore] Supabase initial sync notice:', e);
    }
  }

  /**
   * Enforces privacy by removing drafts and private submissions of other users
   */
  public sanitizeForUser(currentUserEmail?: string | null, currentUserId?: string | null, isReviewerOrHigher = false) {
    this.records = this.records.filter(r => {
      // Seed records are always public
      if (r.id.startsWith('ICH0') || r.id.startsWith('ICH-')) return true;
      // Published records are public
      if ((r.lifecycleStatus || 'published') === 'published') return true;
      // If reviewer or admin, can see submitted/under-review/rejected (never drafts of others)
      if (isReviewerOrHigher && r.lifecycleStatus !== 'draft') return true;
      // Otherwise only the author can see their own drafts and private submissions
      if (!currentUserEmail && !currentUserId) return false;
      return r.contributor === currentUserEmail || (r as any).user_id === currentUserId || (r as any).contributor_email === currentUserEmail;
    });
    this.saveToStorage();
  }

  /**
   * Manually sync all local contributions to Supabase
   */
  public async syncAllLocalToSupabase(): Promise<number> {
    const localOnly = this.records.filter(r => !r.id.startsWith('ICH0') && !r.id.startsWith('ICH-'));
    let count = 0;
    for (const loc of localOnly) {
      const ok = await saveContributionToSupabase(loc);
      if (ok) count++;
    }
    return count;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.records]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAll(): CulturalRecord[] {
    return [...this.records];
  }

  public getById(id: string): CulturalRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  public getPublished(): CulturalRecord[] {
    return this.records.filter(r => !r.lifecycleStatus || r.lifecycleStatus === 'published');
  }

  /**
   * Generates a unique sequential Cultural Record ID (e.g., CR-00021)
   */
  public generateId(): string {
    const id = `CR-${String(this.nextIdCounter).padStart(5, '0')}`;
    this.nextIdCounter += 1;
    return id;
  }

  /**
   * Adds a new cultural contribution to the single source of truth
   */
  public addContribution(
    contribution: Partial<CulturalRecord>,
    userEmail?: string | null,
    userId?: string | null
  ): CulturalRecord {
    const id = contribution.id || this.generateId();
    const nowStr = new Date().toISOString().split('T')[0];

    const newRecord: CulturalRecord = {
      id,
      title: contribution.title || 'Untitled Living Lore',
      nativeTitle: contribution.nativeTitle,
      category: contribution.category || 'oral_story',
      shortDescription: contribution.shortDescription || (contribution.fullDescription ? contribution.fullDescription.slice(0, 160) + '...' : 'Community field recording.'),
      fullDescription: contribution.fullDescription || contribution.shortDescription || 'Field voice lore recorded by community contributor.',
      state: contribution.state || 'Maharashtra',
      district: contribution.district,
      village: contribution.village,
      coordinates: contribution.coordinates,
      originalLanguage: contribution.originalLanguage || 'Hindi',
      dialect: contribution.dialect,
      translationLanguages: contribution.translationLanguages || ['English', 'Hindi'],
      originalAudioUrl: contribution.originalAudioUrl,
      audioDuration: contribution.audioDuration,
      audioScript: contribution.audioScript,
      transcriptOriginal: contribution.transcriptOriginal,
      transcriptEnglish: contribution.transcriptEnglish,
      images: contribution.images || [],
      contributor: contribution.contributor || 'Community Contributor',
      knowledgeHolder: contribution.knowledgeHolder,
      community: contribution.community,
      collector: contribution.collector,
      context: contribution.context,
      festival: contribution.festival,
      recordingDate: contribution.recordingDate || nowStr,
      consentTier: contribution.consentTier || 'public',
      verificationStatus: contribution.verificationStatus || 'unverified',
      lifecycleStatus: contribution.lifecycleStatus || 'queued',
      syncStatus: contribution.syncStatus || 'pending',
      originalContribution: contribution.originalContribution || {
        contributor: contribution.contributor || 'Community Contributor',
        recordingDate: contribution.recordingDate || nowStr,
        consentTier: contribution.consentTier || 'public',
        text: contribution.fullDescription,
        mediaUrl: contribution.originalAudioUrl,
        audioDuration: contribution.audioDuration,
        location: {
          state: contribution.state || 'Maharashtra',
          district: contribution.district,
          village: contribution.village,
          coordinates: contribution.coordinates,
        },
      },
      provenanceTimeline: contribution.provenanceTimeline || [
        {
          stage: 'contributed',
          title: 'Field Contribution Received',
          actor: contribution.contributor || 'Community Contributor',
          date: nowStr,
          details: 'Original voice recording and cultural metadata submitted through Contribute Studio.',
          completed: true,
          current: true,
        },
        {
          stage: 'ai_processing',
          title: 'AI Processing',
          actor: 'Dharohar Gemini AI Engine',
          date: 'Pending',
          details: 'Awaiting AI entity extraction and claim structuring.',
          completed: false,
        },
        {
          stage: 'evidence_added',
          title: 'Evidence Added',
          actor: 'Contributor / Archival Peer',
          date: 'Pending',
          details: 'Awaiting documentary proof attachments.',
          completed: false,
        },
        {
          stage: 'under_review',
          title: 'Community Review',
          actor: 'Regional Review Panel',
          date: 'Pending',
          details: 'Awaiting peer evaluation.',
          completed: false,
        },
        {
          stage: 'verified',
          title: 'Verified',
          actor: 'Authorized Reviewer',
          date: 'Pending',
          details: 'Awaiting formal review verification.',
          completed: false,
        },
        {
          stage: 'published',
          title: 'Published',
          actor: 'National Registry',
          date: 'Pending',
          details: 'Will become discoverable on the Heritage Map upon approval.',
          completed: false,
        },
      ],
      claims: contribution.claims || [],
    };

    // Prepend to records
    this.records = [newRecord, ...this.records.filter(r => r.id !== id)];
    this.saveToStorage();

    // Persist to Supabase Database
    saveContributionToSupabase(newRecord, userEmail, userId).then((ok) => {
      if (ok) {
        console.log('[CulturalStore] Synchronized contribution to Supabase DB:', newRecord.id);
      }
    }).catch(err => {
      console.warn('[CulturalStore] Background sync to Supabase failed:', err);
    });

    return newRecord;
  }

  /**
   * Deletes a record from store and Supabase (allowed for author's drafts or admin)
   */
  public deleteRecord(id: string): boolean {
    const exists = this.records.some(r => r.id === id);
    if (!exists) return false;
    this.records = this.records.filter(r => r.id !== id);
    this.saveToStorage();
    deleteContributionFromSupabase(id).catch(err => {
      console.warn('[CulturalStore] Error deleting contribution from Supabase:', err);
    });
    return true;
  }

  /**
   * Syncs a local queued record to the shared pipeline
   */
  public syncRecord(id: string): CulturalRecord | undefined {
    const target = this.getById(id);
    if (!target) return undefined;

    const nowStr = new Date().toISOString().split('T')[0];
    const timeline = target.provenanceTimeline ? [...target.provenanceTimeline] : [];

    // Advance contributed stage
    if (timeline.length > 0) {
      timeline[0] = {
        ...timeline[0],
        completed: true,
        date: nowStr,
        details: 'Contribution successfully synchronized to Dharohar Setu National Registry.',
      };
    }
    // Set AI Processing as current
    if (timeline.length > 1) {
      timeline[1] = {
        ...timeline[1],
        current: true,
        details: 'Queued in Dharohar AI Pipeline for Gemini multi-stage analysis.',
      };
    }

    const updated: CulturalRecord = {
      ...target,
      syncStatus: 'synced',
      lifecycleStatus: 'synced',
      provenanceTimeline: timeline,
    };

    this.records = this.records.map(r => r.id === id ? updated : r);
    this.saveToStorage();
    saveContributionToSupabase(updated).catch(() => {});
    return updated;
  }

  /**
   * Updates AI-assisted fields after Gemini analysis
   */
  public updateAiAnalysis(id: string, analysis: GeminiCulturalAnalysis): CulturalRecord | undefined {
    const target = this.getById(id);
    if (!target) return undefined;

    const nowStr = new Date().toISOString().split('T')[0];
    const timeline = target.provenanceTimeline ? [...target.provenanceTimeline] : [];

    // Mark AI Processing completed
    if (timeline.length > 1) {
      timeline[1] = {
        ...timeline[1],
        completed: true,
        current: false,
        date: nowStr,
        details: `Gemini AI extracted ${analysis.claims?.length || 0} claims, detected language (${analysis.language}), and structured cultural entities.`,
      };
    }
    // Mark Evidence Added as current
    if (timeline.length > 2) {
      timeline[2] = {
        ...timeline[2],
        current: true,
        details: 'Evidence required for extracted factual & historical claims.',
      };
    }

    const updatedClaims = (analysis.claims || []).map((c, idx) => ({
      id: `CL-${id}-${idx + 1}`,
      text: c.claim,
      status: (c.status === 'Source-supported' ? 'supported' :
               c.status === 'Oral-tradition' ? 'oral_tradition' :
               c.status === 'Conflicting' ? 'conflicting' : 'unverified') as ClaimStatus,
      evidenceIds: [],
      reviewerNote: c.reasoning,
    }));

    const updated: CulturalRecord = {
      ...target,
      title: target.title || analysis.title,
      shortDescription: analysis.summary || target.shortDescription,
      originalLanguage: analysis.language || target.originalLanguage,
      claims: updatedClaims.length > 0 ? updatedClaims : target.claims,
      aiAssistedFields: {
        detectedLanguage: analysis.language,
        suggestedCategory: analysis.category,
        summary: analysis.summary,
        extractedEntities: [...(analysis.people || []), ...(analysis.culturalPractices || []), ...(analysis.keywords || [])],
        extractedClaims: analysis.claims,
        suggestedEvidenceRequirements: analysis.claims?.filter(c => c.evidenceNeeded).map(c => `Evidence needed for: "${c.claim}"`),
        modelUsed: 'gemini-3.5-flash',
        processedAt: nowStr,
      },
      lifecycleStatus: 'evidence_needed',
      provenanceTimeline: timeline,
    };

    this.records = this.records.map(r => r.id === id ? updated : r);
    this.saveToStorage();
    return updated;
  }

  /**
   * Attaches documentary evidence to a record and advances to under_review
   */
  public attachEvidence(recordId: string, evidence: Evidence): CulturalRecord | undefined {
    const target = this.getById(recordId);
    if (!target) return undefined;

    evidenceRegistry.push(evidence);
    const nowStr = new Date().toISOString().split('T')[0];
    const timeline = target.provenanceTimeline ? [...target.provenanceTimeline] : [];

    if (timeline.length > 2) {
      timeline[2] = {
        ...timeline[2],
        completed: true,
        current: false,
        date: nowStr,
        details: `Documentary evidence attached: ${evidence.sourceName} (${evidence.authority}).`,
      };
    }
    if (timeline.length > 3) {
      timeline[3] = {
        ...timeline[3],
        current: true,
        details: 'Assigned for community reviewer evaluation.',
      };
    }

    const updatedClaims = (target.claims || []).map(c => {
      if (c.id === evidence.supportsClaim || !evidence.supportsClaim) {
        return {
          ...c,
          evidenceIds: Array.from(new Set([...c.evidenceIds, evidence.id])),
          status: 'supported' as ClaimStatus,
        };
      }
      return c;
    });

    const updated: CulturalRecord = {
      ...target,
      claims: updatedClaims,
      lifecycleStatus: 'under_review',
      provenanceTimeline: timeline,
    };

    this.records = this.records.map(r => r.id === recordId ? updated : r);
    this.saveToStorage();
    return updated;
  }

  /**
   * Updates claim status individually
   */
  public updateClaimStatus(recordId: string, claimId: string, status: ClaimStatus): CulturalRecord | undefined {
    const target = this.getById(recordId);
    if (!target) return undefined;

    const updatedClaims = (target.claims || []).map(c => {
      if (c.id === claimId) {
        return { ...c, status };
      }
      return c;
    });

    const updated: CulturalRecord = {
      ...target,
      claims: updatedClaims,
    };

    this.records = this.records.map(r => r.id === recordId ? updated : r);
    this.saveToStorage();
    return updated;
  }

  /**
   * Transitions lifecycle status (e.g. verified, published, rejected)
   */
  public transitionStatus(
    id: string,
    newStatus: LifecycleStatus,
    reviewerName: string,
    notes: string
  ): CulturalRecord | undefined {
    const target = this.getById(id);
    if (!target) return undefined;

    const nowStr = new Date().toISOString().split('T')[0];
    const timeline = target.provenanceTimeline ? [...target.provenanceTimeline] : [];

    if (newStatus === 'verified' || newStatus === 'published') {
      const reviewIdx = timeline.findIndex(t => t.stage === 'under_review');
      if (reviewIdx >= 0) {
        timeline[reviewIdx] = {
          ...timeline[reviewIdx],
          completed: true,
          date: nowStr,
          details: `Community review approved by ${reviewerName}. Notes: ${notes || 'Verified authentic tradition.'}`,
        };
      }
      const verifiedIdx = timeline.findIndex(t => t.stage === 'verified');
      if (verifiedIdx >= 0) {
        timeline[verifiedIdx] = {
          ...timeline[verifiedIdx],
          completed: true,
          date: nowStr,
          details: `Verified under Community-Verified status by ${reviewerName}.`,
        };
      }
      if (newStatus === 'published') {
        const pubIdx = timeline.findIndex(t => t.stage === 'published');
        if (pubIdx >= 0) {
          timeline[pubIdx] = {
            ...timeline[pubIdx],
            completed: true,
            current: true,
            date: nowStr,
            details: 'Publicly live on Heritage Map, Search, and Explore streams.',
          };
        }
      }
    } else if (newStatus === 'rejected') {
      const rejIdx = timeline.findIndex(t => t.stage === 'rejected');
      if (rejIdx >= 0) {
        timeline[rejIdx] = {
          ...timeline[rejIdx],
          completed: true,
          current: true,
          date: nowStr,
          details: `Submission rejected: ${notes || 'Conflicting claims / misrepresentation.'}`,
        };
      } else {
        timeline.push({
          stage: 'rejected',
          title: 'Submission Rejected',
          actor: reviewerName,
          date: nowStr,
          details: notes || 'Rejected by community review board.',
          completed: true,
          current: true,
        });
      }
    }

    const updated: CulturalRecord = {
      ...target,
      lifecycleStatus: newStatus,
      verificationStatus: (newStatus === 'published' || newStatus === 'verified') ? 'community_verified' :
                          newStatus === 'rejected' ? 'conflicting_disputed' : target.verificationStatus,
      reviewerDecision: {
        reviewerName,
        decisionDate: nowStr,
        verdict: newStatus === 'published' || newStatus === 'verified' ? 'verified' :
                 newStatus === 'rejected' ? 'rejected' : 'evidence_needed',
        notes: notes || `Transitioned to ${newStatus}`,
      },
      provenanceTimeline: timeline,
    };

    this.records = this.records.map(r => r.id === id ? updated : r);
    this.saveToStorage();
    return updated;
  }
}

export const culturalStore = new CulturalRecordStore();

/**
 * React Hook for real-time reactivity across all components
 */
export function useCulturalRecords(): CulturalRecord[] {
  const [records, setRecords] = useState<CulturalRecord[]>(() => culturalStore.getAll());

  useEffect(() => {
    const unsubscribe = culturalStore.subscribe((updated) => {
      setRecords(updated);
    });
    return unsubscribe;
  }, []);

  return records;
}

/**
 * React Hook for observing a specific cultural record by ID
 */
export function useCulturalRecord(id: string | null | undefined): CulturalRecord | undefined {
  const records = useCulturalRecords();
  if (!id) return undefined;
  return records.find(r => r.id === id);
}
