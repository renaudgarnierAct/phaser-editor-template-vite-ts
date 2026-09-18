export class SaveSystemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SaveSystemError';
    }
}

/** Thrown when no save exists under the requested slot id. */
export class SlotNotFoundError extends SaveSystemError {
    constructor(slotId: string) {
        super(`No save found in slot "${slotId}"`);
        this.name = 'SlotNotFoundError';
    }
}

/** Thrown when a stored save cannot be parsed as JSON or is missing required envelope fields. */
export class CorruptedSaveError extends SaveSystemError {
    constructor(slotId: string, reason: string) {
        super(`Save in slot "${slotId}" is corrupted: ${reason}`);
        this.name = 'CorruptedSaveError';
    }
}

/** Thrown when a stored save's version is newer than this build knows how to read. */
export class UnsupportedVersionError extends SaveSystemError {
    constructor(slotId: string, storedVersion: number, currentVersion: number) {
        super(
            `Save in slot "${slotId}" has version ${storedVersion}, newer than the supported version ${currentVersion}`
        );
        this.name = 'UnsupportedVersionError';
    }
}

/** Thrown when a migration step fails to produce a usable payload. */
export class MigrationFailedError extends SaveSystemError {
    constructor(slotId: string, fromVersion: number, reason: string) {
        super(`Migration from version ${fromVersion} failed for slot "${slotId}": ${reason}`);
        this.name = 'MigrationFailedError';
    }
}

/** Thrown when no storage backend is available (e.g. `localStorage` is undefined) and none was injected. */
export class StorageUnavailableError extends SaveSystemError {
    constructor() {
        super('No storage backend is available; pass an explicit `storage` option');
        this.name = 'StorageUnavailableError';
    }
}

/** Thrown when a caller attempts to use the reserved quick-save slot id as a normal save slot. */
export class ReservedSlotIdError extends SaveSystemError {
    constructor(slotId: string) {
        super(`Slot id "${slotId}" is reserved for quick saves`);
        this.name = 'ReservedSlotIdError';
    }
}
