import type { Migration, SaveEnvelope, SaveKind, SaveSlotInfo, StorageLike } from './types.ts';
import {
    CorruptedSaveError,
    MigrationFailedError,
    ReservedSlotIdError,
    SlotNotFoundError,
    StorageUnavailableError,
    UnsupportedVersionError
} from './errors.ts';

/** Reserved slot id used for the single quick-save entry. */
export const QUICK_SAVE_SLOT_ID = '__quick__';

const DEFAULT_NAMESPACE = 'phaser-save';

function getDefaultStorage(): StorageLike {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (candidate === undefined) {
        throw new StorageUnavailableError();
    }
    return candidate;
}

export interface SaveSystemOptions<TPayload> {
    /** The current (latest) schema version for `TPayload`. */
    currentVersion: number;
    /**
     * Migration steps keyed by source version: `migrations[1]` migrates a version-1 payload to
     * version 2, `migrations[2]` migrates version 2 to version 3, and so on. A stored save is
     * migrated through every step needed to reach `currentVersion` before validation.
     */
    migrations?: Record<number, Migration>;
    /** Validates (and narrows) a fully-migrated raw payload, throwing if it is still invalid. */
    validatePayload: (payload: unknown) => TPayload;
    /** Storage backend to use; defaults to `globalThis.localStorage`. */
    storage?: StorageLike;
    /** Key prefix used to namespace this save system's slots within the shared storage. */
    namespace?: string;
}

/**
 * Versioned save/load system backed by a `localStorage`-like key/value store. Supports a single
 * reserved "quick save" slot plus any number of named "normal save" slots, and migrates payloads
 * saved under older schema versions forward before returning them.
 */
export class SaveSystem<TPayload> {
    private readonly currentVersion: number;
    private readonly migrations: Record<number, Migration>;
    private readonly validatePayload: (payload: unknown) => TPayload;
    private readonly namespace: string;
    private readonly storageOverride?: StorageLike;

    constructor(options: SaveSystemOptions<TPayload>) {
        if (!Number.isInteger(options.currentVersion) || options.currentVersion < 1) {
            throw new Error('currentVersion must be a positive integer');
        }

        this.currentVersion = options.currentVersion;
        this.migrations = options.migrations ?? {};
        this.validatePayload = options.validatePayload;
        this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
        this.storageOverride = options.storage;
    }

    private get storage(): StorageLike {
        return this.storageOverride ?? getDefaultStorage();
    }

    private keyFor(slotId: string): string {
        return `${this.namespace}:${slotId}`;
    }

    private assertNotReserved(slotId: string): void {
        if (slotId === QUICK_SAVE_SLOT_ID) {
            throw new ReservedSlotIdError(slotId);
        }
    }

    private write(slotId: string, kind: SaveKind, payload: TPayload): void {
        const envelope: SaveEnvelope<TPayload> = {
            version: this.currentVersion,
            kind,
            savedAt: new Date().toISOString(),
            payload
        };
        this.storage.setItem(this.keyFor(slotId), JSON.stringify(envelope));
    }

    private read(slotId: string): SaveEnvelope<TPayload> {
        const raw = this.storage.getItem(this.keyFor(slotId));
        if (raw === null) {
            throw new SlotNotFoundError(slotId);
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw new CorruptedSaveError(slotId, 'stored value is not valid JSON');
        }

        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof (parsed as { version?: unknown }).version !== 'number'
        ) {
            throw new CorruptedSaveError(slotId, 'missing or invalid "version" field');
        }

        const envelope = parsed as SaveEnvelope<unknown>;

        if (envelope.version > this.currentVersion) {
            throw new UnsupportedVersionError(slotId, envelope.version, this.currentVersion);
        }

        let payload: unknown = envelope.payload;
        let version = envelope.version;
        while (version < this.currentVersion) {
            const migrate = this.migrations[version];
            if (migrate === undefined) {
                throw new MigrationFailedError(slotId, version, `no migration registered for version ${version}`);
            }
            try {
                payload = migrate(payload);
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                throw new MigrationFailedError(slotId, version, reason);
            }
            version += 1;
        }

        let validated: TPayload;
        try {
            validated = this.validatePayload(payload);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new CorruptedSaveError(slotId, `payload failed validation: ${reason}`);
        }

        return { ...envelope, version, payload: validated };
    }

    /** Overwrites the single quick-save slot with `payload`. */
    quickSave(payload: TPayload): void {
        this.write(QUICK_SAVE_SLOT_ID, 'quick', payload);
    }

    /** Loads the quick-save slot; throws {@link SlotNotFoundError} if none exists. */
    loadQuickSave(): TPayload {
        return this.read(QUICK_SAVE_SLOT_ID).payload;
    }

    /** True if a quick save currently exists. */
    hasQuickSave(): boolean {
        return this.storage.getItem(this.keyFor(QUICK_SAVE_SLOT_ID)) !== null;
    }

    /** Writes `payload` to a named normal-save slot, overwriting any existing save in that slot. */
    save(slotId: string, payload: TPayload): void {
        this.assertNotReserved(slotId);
        this.write(slotId, 'normal', payload);
    }

    /** Loads a named normal-save slot; throws {@link SlotNotFoundError} if none exists. */
    load(slotId: string): TPayload {
        this.assertNotReserved(slotId);
        return this.read(slotId).payload;
    }

    /** True if a normal save exists under `slotId`. */
    hasSave(slotId: string): boolean {
        this.assertNotReserved(slotId);
        return this.storage.getItem(this.keyFor(slotId)) !== null;
    }

    /** Deletes any save (quick or normal) stored under `slotId`. No-op if it does not exist. */
    deleteSlot(slotId: string): void {
        this.storage.removeItem(this.keyFor(slotId));
    }

    /**
     * Lists metadata for every save slot managed by this system, most recently saved first.
     * Entries that fail to parse are skipped rather than throwing, since listing should be
     * resilient to a single corrupted slot.
     */
    listSlots(): SaveSlotInfo[] {
        const prefix = `${this.namespace}:`;
        const infos: SaveSlotInfo[] = [];

        for (let i = 0; i < this.storage.length; i += 1) {
            const key = this.storage.key(i);
            if (key === null || !key.startsWith(prefix)) {
                continue;
            }

            const raw = this.storage.getItem(key);
            if (raw === null) {
                continue;
            }

            try {
                const parsed = JSON.parse(raw) as SaveEnvelope<unknown>;
                infos.push({
                    slotId: key.slice(prefix.length),
                    kind: parsed.kind,
                    version: parsed.version,
                    savedAt: parsed.savedAt
                });
            } catch {
                continue;
            }
        }

        return infos.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    }
}
