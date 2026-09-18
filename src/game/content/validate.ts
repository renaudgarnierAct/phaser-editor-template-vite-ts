import type { ChapterData } from '../data/types.ts';
import type { EventScript } from '../events/types.ts';
import type { ChapterManifest } from './types.ts';
import { DuplicateHookEventIdError, InvalidChapterManifestError } from './errors.ts';

/** Validates the static shape of a {@link ChapterManifest} before any of its refs are fetched. */
export function validateChapterManifest(manifest: ChapterManifest): void {
    if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
        throw new InvalidChapterManifestError('"id" must be a non-empty string');
    }

    if (typeof manifest.chapterDataRef !== 'string' || manifest.chapterDataRef.length === 0) {
        throw new InvalidChapterManifestError('"chapterDataRef" must be a non-empty string');
    }

    if (manifest.hooks === undefined || typeof manifest.hooks !== 'object') {
        throw new InvalidChapterManifestError('"hooks" must be an object');
    }
}

/**
 * Cross-checks event scripts against the chapter's unit roster: any `unitId` referenced by a
 * `unit_dead`, `boss_dead`, `arrival`, `recruitment`, `recruit`, `give_item` or `spawn` payload
 * must exist among `chapter.units`, unless the payload is generic (e.g. a boss_dead with no unitId).
 */
export function validateHookUnitReferences(chapter: ChapterData, scripts: EventScript[]): void {
    const unitIds = new Set(chapter.units.map((unit) => unit.id));

    for (const script of scripts) {
        for (const event of script.events) {
            const trigger = event.trigger as unknown as Record<string, unknown>;
            const referencedUnitId = trigger.unitId;
            if (typeof referencedUnitId === 'string' && !unitIds.has(referencedUnitId)) {
                throw new InvalidChapterManifestError(
                    `event "${event.id}" references unknown unit id "${referencedUnitId}"`
                );
            }
        }
    }
}

/** Merges hook scripts (in phase order) into a single {@link EventScript}, rejecting duplicate event ids. */
export function mergeEventScripts(id: string, scripts: EventScript[]): EventScript {
    const seenIds = new Set<string>();
    const events = scripts.flatMap((script) => script.events);

    for (const event of events) {
        if (seenIds.has(event.id)) {
            throw new DuplicateHookEventIdError(event.id);
        }
        seenIds.add(event.id);
    }

    return { id, events };
}
