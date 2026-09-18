import type { AIProfile } from './types.ts';

/** Raw shape of an `ai-chapter-*.json` descriptor file. */
export interface AIChapterFile {
    chapterId: string;
    units: Array<{ unitId: string } & AIProfile>;
}

/** Per-unit AI profiles resolved from an `AIChapterFile`, keyed by unit id. */
export type AIProfileMap = ReadonlyMap<string, AIProfile>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes a parsed `ai-chapter-*.json` payload into an
 * `AIProfileMap`. Kept separate from fetching so it can be unit tested with
 * plain objects, mirroring the rest of the data-loading modules in this
 * project.
 */
export function parseAIChapterFile(data: unknown): AIProfileMap {
    if (!isPlainObject(data) || typeof data.chapterId !== 'string' || !Array.isArray(data.units)) {
        throw new Error('Invalid AI chapter file: expected { chapterId: string, units: [...] }');
    }

    const profiles = new Map<string, AIProfile>();
    for (const entry of data.units) {
        if (!isPlainObject(entry) || typeof entry.unitId !== 'string' || typeof entry.behavior !== 'string') {
            throw new Error('Invalid AI chapter file: each unit entry needs a unitId and a behavior');
        }

        const { unitId, ...profile } = entry as { unitId: string } & AIProfile;
        profiles.set(unitId, profile);
    }

    return profiles;
}

/** Loads and validates an `ai-chapter-*.json` descriptor from a JSON URL. */
export async function loadAIChapterFile(path: string): Promise<AIProfileMap> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load AI chapter data: ${response.status}`);
    }

    return parseAIChapterFile(await response.json());
}

/** Resolves a unit's `AIProfile`, falling back to `defaultBehavior` (default: `'aggressive'`) when absent. */
export function resolveAIProfile(unitId: string, profiles: AIProfileMap, defaultBehavior: AIProfile['behavior'] = 'aggressive'): AIProfile {
    return profiles.get(unitId) ?? { behavior: defaultBehavior };
}
