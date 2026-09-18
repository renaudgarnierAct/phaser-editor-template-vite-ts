import type { EventAction, EventScript } from '../events/types.ts';
import type { DialogueCatalog, DialogueCatalogEntry } from './types.ts';
import { InvalidDialogueCatalogError, UnknownDialogueRefError } from './errors.ts';

/** Fetches and validates a {@link DialogueCatalog} JSON document. */
export async function loadDialogueCatalog(path: string): Promise<DialogueCatalog> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load dialogue catalog: ${response.status}`);
    }

    const catalog = (await response.json()) as DialogueCatalog;
    validateDialogueCatalog(catalog);
    return catalog;
}

/** Validates that every entry has a unique, non-empty id and a non-empty list of string lines. */
export function validateDialogueCatalog(catalog: DialogueCatalog): void {
    const seenIds = new Set<string>();

    for (const entry of catalog.entries) {
        if (typeof entry.id !== 'string' || entry.id.length === 0) {
            throw new InvalidDialogueCatalogError('every entry must have a non-empty "id"');
        }

        if (seenIds.has(entry.id)) {
            throw new InvalidDialogueCatalogError(`duplicate entry id "${entry.id}"`);
        }
        seenIds.add(entry.id);

        if (!Array.isArray(entry.lines) || entry.lines.length === 0 || entry.lines.some((line) => typeof line !== 'string')) {
            throw new InvalidDialogueCatalogError(`entry "${entry.id}" must have a non-empty array of string "lines"`);
        }
    }
}

/**
 * Returns a copy of `script` where every `dialogue` action carrying a `dialogueRef` (instead of
 * inline `speaker`/`lines`) is expanded from `catalog`. Actions that already carry inline lines,
 * or that are not dialogue actions, are left untouched. This lets content authors reuse the same
 * placeholder/localized dialogue entry from several events without duplicating text.
 */
export function resolveDialogueRefs(script: EventScript, catalog: DialogueCatalog): EventScript {
    const byId = new Map<string, DialogueCatalogEntry>(catalog.entries.map((entry) => [entry.id, entry]));

    return {
        ...script,
        events: script.events.map((event) => ({
            ...event,
            actions: event.actions.map((action) => resolveAction(action, byId))
        }))
    };
}

function resolveAction(action: EventAction, byId: Map<string, DialogueCatalogEntry>): EventAction {
    const record = action as unknown as Record<string, unknown>;
    if (action.type !== 'dialogue' || typeof record.dialogueRef !== 'string') {
        return action;
    }

    const entry = byId.get(record.dialogueRef);
    if (entry === undefined) {
        throw new UnknownDialogueRefError(record.dialogueRef);
    }

    return { type: 'dialogue', speaker: entry.speaker, lines: entry.lines };
}
