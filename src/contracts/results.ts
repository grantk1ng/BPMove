/**
 * Shared Result type for fallible operations.
 *
 * Used across all services and providers — BLE connections, audio playback,
 * Spotify auth, API calls. Forces callers to handle failure explicitly.
 */
export type Result<T> = {ok: true; data: T} | {ok: false; error: string};
