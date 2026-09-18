import type { WorldProgressState } from '../world/types.ts';
import { SaveSystem, type SaveSystemOptions } from './SaveSystem.ts';
import type { Migration, StorageLike } from './types.ts';

/**
 * Current schema version for {@link WorldProgressState} saves.
 *
 * History:
 * - v1: `{ completedChapterIds, currentNodeId }` (no flags).
 * - v2: adds the `flags` map used by data-driven unlock conditions.
 */
export const WORLD_SAVE_VERSION = 2;

const migrations: Record<number, Migration> = {
    // v1 -> v2: introduce the `flags` map, defaulting to empty for pre-existing saves.
    1: (payload) => ({ ...(payload as Record<string, unknown>), flags: {} })
};

function validateWorldProgress(payload: unknown): WorldProgressState {
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('payload must be an object');
    }

    const candidate = payload as Partial<WorldProgressState>;

    if (!Array.isArray(candidate.completedChapterIds) || !candidate.completedChapterIds.every((id) => typeof id === 'string')) {
        throw new Error('completedChapterIds must be a string array');
    }
    if (typeof candidate.currentNodeId !== 'string') {
        throw new Error('currentNodeId must be a string');
    }
    if (typeof candidate.flags !== 'object' || candidate.flags === null) {
        throw new Error('flags must be an object');
    }

    return {
        completedChapterIds: [...candidate.completedChapterIds],
        currentNodeId: candidate.currentNodeId,
        flags: { ...candidate.flags }
    };
}

/** Creates a {@link SaveSystem} preconfigured for {@link WorldProgressState}, with its migrations wired in. */
export function createWorldSaveSystem(options: { storage?: StorageLike; namespace?: string } = {}): SaveSystem<WorldProgressState> {
    const saveSystemOptions: SaveSystemOptions<WorldProgressState> = {
        currentVersion: WORLD_SAVE_VERSION,
        migrations,
        validatePayload: validateWorldProgress,
        storage: options.storage,
        namespace: options.namespace ?? 'world-progress'
    };
    return new SaveSystem<WorldProgressState>(saveSystemOptions);
}
