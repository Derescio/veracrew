/**
 * Type definitions for the offline clock-in queue.
 * Events are stored in IndexedDB by the service worker and synced when
 * connectivity is restored via Background Sync.
 */

export interface OfflineClockInEvent {
  /** Client-generated UUID; used for deduplication on the server. */
  id: string;
  organizationId: string;
  userId: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  /** ISO 8601 timestamp captured at the moment the user tapped Clock In/Out. */
  timestamp: string;
  /** GPS coordinates at the time of the event, if available. */
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  };
  /** Number of sync attempts made so far. */
  syncAttempts: number;
  /** ISO 8601 timestamp of the last failed sync attempt, if any. */
  lastSyncError?: string;
}
