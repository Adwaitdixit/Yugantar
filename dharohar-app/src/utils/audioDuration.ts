/* ============================================================
   Dharohar Setu — Audio Duration & WebM Resolution Engine
   Reliable browser-side duration resolution for WebM MediaRecorder Blobs
   ============================================================ */

/**
 * Attempts to resolve audio duration using the Web Audio API's decodeAudioData.
 * This directly decodes the audio frames into PCM samples and calculates
 * the mathematical duration: (samples / sampleRate).
 * Works reliably across WebM, Opus, MP3, WAV, OGG, M4A, etc.
 */
export async function decodeAudioDurationViaAudioContext(blob: Blob): Promise<number | null> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    
    ctx.close().catch(() => {});

    if (Number.isFinite(duration) && duration > 0) {
      console.log(`[AudioMetadata] AudioContext decoded exact duration: ${duration.toFixed(2)}s`);
      return duration;
    }
    return null;
  } catch (err) {
    console.warn('[AudioMetadata] AudioContext decodeAudioData could not decode audio:', err);
    return null;
  }
}

/**
 * Resolves the real, finite audio duration using:
 * 1. Known duration hint (e.g. live recording elapsed time) if provided
 * 2. Web Audio API decodeAudioData (exact sample duration)
 * 3. HTMLAudioElement with Chromium seek-to-end resolution
 *
 * NEVER returns 0 for an unknown duration. Returns null if duration cannot be resolved.
 */
export async function resolveAccurateAudioDuration(
  blob: Blob,
  objectUrl: string,
  knownDurationHint?: number | null
): Promise<number | null> {
  console.log('[AudioMetadata] Starting accurate duration resolution for:', {
    blobType: blob.type,
    blobSize: blob.size,
    objectUrl,
    knownDurationHint,
  });

  if (blob.size === 0) {
    console.warn('[AudioMetadata] Blob is empty (0 bytes).');
    return null;
  }

  // 1. If we have a measured live recording duration hint from MediaRecorder, use it!
  if (typeof knownDurationHint === 'number' && Number.isFinite(knownDurationHint) && knownDurationHint > 0) {
    console.log(`[AudioMetadata] Using live recording measured elapsed duration: ${knownDurationHint.toFixed(2)}s`);
    return knownDurationHint;
  }

  // 2. Try Web Audio API decodeAudioData for uploaded or restored audio
  const decodedDuration = await decodeAudioDurationViaAudioContext(blob);
  if (decodedDuration !== null && decodedDuration > 0) {
    return decodedDuration;
  }

  // 3. HTMLAudioElement resolution with seek-to-end for Chromium WebM
  return new Promise<number | null>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('error', onError);
    };

    const onLoadedMetadata = () => {
      console.log('[AudioMetadata] loadedmetadata event fired:', {
        readyState: audio.readyState,
        rawDuration: audio.duration,
      });

      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        cleanup();
        console.log(`[AudioMetadata] HTMLAudioElement resolved finite duration: ${audio.duration.toFixed(2)}s`);
        resolve(audio.duration);
        return;
      }

      // If duration is Infinity or NaN (standard WebM MediaRecorder behavior in Chromium)
      if (audio.duration === Infinity || isNaN(audio.duration)) {
        console.log('[AudioMetadata] Duration is Infinity/NaN. Applying Chromium seek-to-end trick...');
        const onSeekedOrUpdate = () => {
          audio.removeEventListener('seeked', onSeekedOrUpdate);
          audio.removeEventListener('timeupdate', onSeekedOrUpdate);
          const resolvedDur = audio.duration;
          console.log('[AudioMetadata] Seeked to end complete. Duration is now:', resolvedDur);
          audio.currentTime = 0;
          cleanup();
          if (Number.isFinite(resolvedDur) && resolvedDur > 0) {
            resolve(resolvedDur);
          } else {
            resolve(null);
          }
        };

        audio.addEventListener('seeked', onSeekedOrUpdate, { once: true });
        audio.addEventListener('timeupdate', onSeekedOrUpdate, { once: true });
        // Seek to large value to force Chromium to parse clusters to end
        try {
          audio.currentTime = 1e101;
        } catch {
          audio.currentTime = 1000000;
        }
      }
    };

    const onDurationChange = () => {
      console.log('[AudioMetadata] durationchange event fired. Duration:', audio.duration);
      if (Number.isFinite(audio.duration) && audio.duration > 0 && !resolved) {
        cleanup();
        resolve(audio.duration);
      }
    };

    const onError = (e: Event) => {
      console.warn('[AudioMetadata] HTMLAudioElement failed to load audio metadata:', e, audio.error);
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('error', onError);

    // 3-second timeout guard
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          console.log(`[AudioMetadata] Timeout resolved duration: ${audio.duration.toFixed(2)}s`);
          resolve(audio.duration);
        } else {
          console.warn('[AudioMetadata] Duration resolution timed out without finite duration.');
          resolve(null);
        }
      }
    }, 3000);

    audio.src = objectUrl;
  });
}

/**
 * Formats duration into MM:SS.
 * IMPORTANT:
 * - Returns "duration unavailable" if duration is null, undefined, NaN, or non-finite.
 * - Only returns "00:00" if duration is strictly 0.
 */
export function formatAudioDuration(durationSec: number | null | undefined): string {
  if (durationSec === null || durationSec === undefined || !Number.isFinite(durationSec)) {
    return 'duration unavailable';
  }
  const totalSeconds = Math.round(durationSec);
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Formats playback current time (always MM:SS)
 */
export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
