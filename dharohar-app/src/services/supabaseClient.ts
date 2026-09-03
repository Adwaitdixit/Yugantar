import { createClient } from '@supabase/supabase-js';
import type { CulturalRecord } from '../data/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rcbukznnilbhwrgcyxlw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjYnVrem5uaWxiaHdyZ2N5eGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MDE2NzIsImV4cCI6MjEwMzk3NzY3Mn0.X1jbYchr3_sZY6BJQBZ-ShhIVVUPT4sx0PHLvR8HW10';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const BUCKET_NAME = 'cultural-recordings';

export type AppRole = 'normal_user' | 'contributor' | 'reviewer' | 'expert' | 'admin';

/**
 * Fetch the role for a given user from public.user_roles
 */
export async function fetchUserRole(userId: string): Promise<AppRole> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Role] Error fetching user role:', error.message);
      return 'normal_user';
    }

    return (data?.role as AppRole) || 'normal_user';
  } catch (err) {
    console.warn('[Supabase Role] Exception fetching role:', err);
    return 'normal_user';
  }
}

/**
 * Update a user's role in public.user_roles (Admin-only)
 */
export async function updateUserRole(targetUserId: string, newRole: AppRole): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: targetUserId,
        role: newRole,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Supabase Role] Failed to update role:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase Role] Exception updating role:', err);
    return false;
  }
}

/**
 * Fetch all users with their roles (Admin only)
 */
export async function fetchAllUsersWithRoles(): Promise<{ userId: string; role: AppRole; createdAt: string }[]> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Role] Error listing user roles:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      role: row.role as AppRole,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('[Supabase Role] Exception listing roles:', err);
    return [];
  }
}

/**
 * Upload an audio blob or file to Supabase Storage in user's isolated folder
 */
export async function uploadAudioRecording(
  audio: Blob | File,
  filenamePrefix = 'voice',
  userId?: string | null
): Promise<string | null> {
  try {
    const ext = audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'm4a' : audio.type.includes('wav') ? 'wav' : 'webm';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    // User folder isolation enforces Storage RLS policy
    const folder = userId ? `users/${userId}` : 'audio';
    const filePath = `${folder}/${filenamePrefix}_${timestamp}_${randomStr}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, audio, {
        cacheControl: '3600',
        upsert: false,
        contentType: audio.type || 'audio/webm',
      });

    if (error) {
      console.warn('[Supabase Storage] Audio upload failed:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Exception during audio upload:', err);
    return null;
  }
}

/**
 * Upload video file to Supabase Storage
 */
export async function uploadVideoFile(payload: Blob | File, prefix = 'video_lore', userId?: string | null): Promise<string | null> {
  try {
    let fileType = 'video/mp4';

    if (payload instanceof File) {
      fileType = payload.type || fileType;
    } else {
      fileType = payload.type || fileType;
    }

    const ext = fileType.includes('mp4') ? 'mp4'
      : fileType.includes('webm') ? 'webm'
      : fileType.includes('mov') ? 'mov'
      : fileType.includes('mkv') ? 'mkv'
      : 'mp4';

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const folder = userId ? `users/${userId}` : 'anonymous';
    const filePath = `${folder}/${prefix}_${timestamp}_${randomStr}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, payload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileType,
      });

    if (error) {
      console.warn('[Supabase Storage] Video upload failed:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Exception during video upload:', err);
    return null;
  }
}

/**
 * Upload image file to Supabase Storage in user's folder
 */
export async function uploadImageFile(file: File, userId?: string | null): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const folder = userId ? `users/${userId}` : 'photos';
    const filePath = `${folder}/img_${timestamp}_${randomStr}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (error) {
      console.warn('[Supabase Storage] Photo upload failed:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Photo upload exception:', err);
    return null;
  }
}

/**
 * Save or update a cultural record in the Supabase `cultural_contributions` table.
 * Enforces that normal users can only save as draft or submitted with unverified status.
 */
export async function saveContributionToSupabase(
  record: CulturalRecord,
  userEmail?: string | null,
  userId?: string | null
): Promise<boolean> {
  try {
    const row = {
      id: record.id,
      user_id: userId || null,
      contributor_email: userEmail || null,
      title: record.title,
      native_title: record.nativeTitle || null,
      category: record.category,
      short_description: record.shortDescription || null,
      full_description: record.fullDescription || null,
      state: record.state,
      district: record.district || null,
      village: record.village || null,
      coordinates: record.coordinates || null,
      original_language: record.originalLanguage,
      dialect: record.dialect || null,
      translation_languages: record.translationLanguages || ['English', 'Hindi'],
      original_audio_url: record.originalAudioUrl || null,
      audio_duration: record.audioDuration || null,
      audio_script: record.audioScript || null,
      transcript_original: record.transcriptOriginal || null,
      transcript_english: record.transcriptEnglish || null,
      images: record.images || [],
      contributor: record.contributor || userEmail || 'Community Contributor',
      knowledge_holder: record.knowledgeHolder || null,
      community: record.community || null,
      collector: record.collector || null,
      context: record.context || null,
      festival: record.festival || null,
      recording_date: record.recordingDate || new Date().toISOString().split('T')[0],
      consent_tier: record.consentTier || 'public',
      verification_status: record.verificationStatus || 'unverified',
      lifecycle_status: record.lifecycleStatus || 'submitted',
      sync_status: 'synced',
      provenance_timeline: record.provenanceTimeline || [],
      claims: record.claims || [],
      raw_data: {
        submittedAt: new Date().toISOString(),
        originalContribution: record.originalContribution || null,
      },
    };

    const { error } = await supabase
      .from('cultural_contributions')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase DB] Failed to save contribution (RLS check):', error.message);
      return false;
    }

    console.log('[Supabase DB] Successfully saved contribution:', record.id);
    return true;
  } catch (err) {
    console.warn('[Supabase DB] Exception saving contribution:', err);
    return false;
  }
}

/**
 * Delete a contribution from Supabase (Only author drafts or Admin allowed by RLS)
 */
export async function deleteContributionFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cultural_contributions')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('[Supabase DB] Failed to delete contribution:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase DB] Exception deleting contribution:', err);
    return false;
  }
}

/**
 * Add an internal review note (Only accessible by Reviewer / Expert / Admin)
 */
export async function addContributionReview(
  contributionId: string,
  verdict: string,
  internalNotes: string,
  reviewerName: string,
  reviewerId?: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contribution_reviews')
      .insert({
        contribution_id: contributionId,
        reviewer_id: reviewerId || null,
        reviewer_name: reviewerName,
        verdict,
        internal_notes: internalNotes,
      });

    if (error) {
      console.warn('[Supabase Review] Failed to add review note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Review] Exception adding review note:', err);
    return false;
  }
}

/**
 * Fetch review notes for a contribution (RLS permits only Reviewer/Expert/Admin)
 */
export async function fetchReviewsForContribution(contributionId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('contribution_reviews')
      .select('*')
      .eq('contribution_id', contributionId)
      .order('created_at', { ascending: false });

    if (error) {
      // Normal users will get an RLS rejection here, which is expected and secure
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch cultural contributions stored in Supabase governed by RLS
 */
export async function fetchContributionsFromSupabase(): Promise<CulturalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('cultural_contributions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase DB] Error fetching contributions:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((row: any): CulturalRecord => ({
      id: row.id,
      title: row.title,
      nativeTitle: row.native_title || undefined,
      category: row.category,
      shortDescription: row.short_description || '',
      fullDescription: row.full_description || '',
      state: row.state,
      district: row.district || undefined,
      village: row.village || undefined,
      coordinates: row.coordinates || undefined,
      originalLanguage: row.original_language,
      dialect: row.dialect || undefined,
      translationLanguages: row.translation_languages || ['English', 'Hindi'],
      originalAudioUrl: row.original_audio_url || undefined,
      audioDuration: row.audio_duration ? Number(row.audio_duration) : undefined,
      audioScript: row.audio_script || undefined,
      transcriptOriginal: row.transcript_original || undefined,
      transcriptEnglish: row.transcript_english || undefined,
      images: row.images || [],
      contributor: row.contributor || 'Community Contributor',
      knowledgeHolder: row.knowledge_holder || undefined,
      community: row.community || undefined,
      collector: row.collector || undefined,
      context: row.context || undefined,
      festival: row.festival || undefined,
      recordingDate: row.recording_date || undefined,
      consentTier: row.consent_tier || 'public',
      verificationStatus: row.verification_status || 'unverified',
      lifecycleStatus: row.lifecycle_status || 'submitted',
      syncStatus: 'synced',
      provenanceTimeline: row.provenance_timeline || [],
      claims: row.claims || [],
      originalContribution: row.raw_data?.originalContribution,
    }));
  } catch (err) {
    console.warn('[Supabase DB] Exception fetching contributions:', err);
    return [];
  }
}

/**
 * Direct password update via RPC for accounts without email dependence (bypasses email rate limits)
 */
export async function resetUserPasswordDirect(userEmail: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('reset_user_password', {
      user_email: userEmail.trim(),
      new_password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: 'No account found matching this email address.' };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

