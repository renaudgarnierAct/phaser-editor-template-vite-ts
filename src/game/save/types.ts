/** Minimal storage contract satisfied by the DOM `Storage` interface (`window.localStorage`). */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key(index: number): string | null;
    readonly length: number;
}

/** The kind of save slot, used for display/filtering purposes. */
export type SaveKind = 'quick' | 'normal';

/** The versioned, on-disk envelope wrapping a save's actual payload. */
export interface SaveEnvelope<TPayload> {
    version: number;
    kind: SaveKind;
    savedAt: string;
    payload: TPayload;
}

/**
 * Migrates a raw, previously-serialized payload from one schema version to the next
 * (`fromVersion` -> `fromVersion + 1`). Receives and returns `unknown` since older payload shapes
 * are not statically known; throw to signal an unrecoverable migration.
 */
export type Migration = (payload: unknown) => unknown;

/** Lightweight metadata about a stored save, without deserializing its full payload. */
export interface SaveSlotInfo {
    slotId: string;
    kind: SaveKind;
    version: number;
    savedAt: string;
}
