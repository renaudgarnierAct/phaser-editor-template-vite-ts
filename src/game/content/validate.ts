import type { ChapterData } from '../data/types.ts';
import type { EventScript, GameEvent, Trigger, VariableRef } from '../events/types.ts';
import type { ChapterHookPhase, ChapterManifest } from './types.ts';
import {
    DuplicateHookEventIdError,
    InvalidChapterDataError,
    InvalidChapterManifestError,
    InvalidHookScriptError
} from './errors.ts';

const HOOK_PHASES: ChapterHookPhase[] = ['preChapter', 'duringChapter', 'postChapter'];
const TRIGGER_TYPES = new Set<Trigger['type']>([
    'chapter_start',
    'turn',
    'unit_dead',
    'boss_dead',
    'arrival',
    'house',
    'village',
    'recruitment',
    'variable_change'
]);
const UNIT_ACTION_TYPES = new Set(['recruit', 'give_item', 'spawn']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function isMapCoordinate(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0;
}

function isVariableRef(value: unknown): value is VariableRef {
    return isRecord(value)
        && (value.scope === 'chapter' || value.scope === 'campaign' || value.scope === 'global')
        && isNonEmptyString(value.key);
}

/** Validates the static shape of a {@link ChapterManifest} before any of its refs are fetched. */
export function validateChapterManifest(manifest: ChapterManifest): void {
    if (!isRecord(manifest)) {
        throw new InvalidChapterManifestError('manifest must be an object');
    }

    if (!isNonEmptyString(manifest.id)) {
        throw new InvalidChapterManifestError('"id" must be a non-empty string');
    }

    if (!isNonEmptyString(manifest.name)) {
        throw new InvalidChapterManifestError('"name" must be a non-empty string');
    }

    if (!isNonEmptyString(manifest.chapterDataRef)) {
        throw new InvalidChapterManifestError('"chapterDataRef" must be a non-empty string');
    }

    if (manifest.dialogueCatalogRef !== undefined && !isNonEmptyString(manifest.dialogueCatalogRef)) {
        throw new InvalidChapterManifestError('"dialogueCatalogRef" must be a non-empty string when provided');
    }

    if (!isRecord(manifest.hooks)) {
        throw new InvalidChapterManifestError('"hooks" must be an object');
    }

    for (const phase of HOOK_PHASES) {
        const ref = manifest.hooks[phase];
        if (ref !== undefined && !isNonEmptyString(ref)) {
            throw new InvalidChapterManifestError(`"hooks.${phase}" must be a non-empty string when provided`);
        }
    }
}

/** Validates map dimensions, terrain references, and the initial unit roster. */
export function validateChapterData(chapter: ChapterData, expectedChapterId?: string): void {
    if (!isRecord(chapter)) {
        throw new InvalidChapterDataError('chapter must be an object');
    }

    if (!isNonEmptyString(chapter.id)) {
        throw new InvalidChapterDataError('"id" must be a non-empty string');
    }
    if (expectedChapterId !== undefined && chapter.id !== expectedChapterId) {
        throw new InvalidChapterDataError(`id "${chapter.id}" does not match manifest id "${expectedChapterId}"`);
    }
    if (!isNonEmptyString(chapter.name)) {
        throw new InvalidChapterDataError('"name" must be a non-empty string');
    }
    if (!isRecord(chapter.map)) {
        throw new InvalidChapterDataError('"map" must be an object');
    }

    const { width, height, tiles, terrainLegend } = chapter.map;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new InvalidChapterDataError('"map.width" and "map.height" must be positive integers');
    }
    if (!Array.isArray(tiles) || tiles.length !== height) {
        throw new InvalidChapterDataError(`"map.tiles" must contain exactly ${height} rows`);
    }
    const invalidRow = tiles.findIndex((row) => typeof row !== 'string' || [...row].length !== width);
    if (invalidRow !== -1) {
        throw new InvalidChapterDataError(`map row ${invalidRow} must contain exactly ${width} terrain codes`);
    }
    if (!isRecord(terrainLegend) || Object.keys(terrainLegend).length === 0) {
        throw new InvalidChapterDataError('"map.terrainLegend" must be a non-empty object');
    }
    if (!isRecord(chapter.terrain)) {
        throw new InvalidChapterDataError('"terrain" must be an object');
    }

    for (const [code, terrainId] of Object.entries(terrainLegend)) {
        if ([...code].length !== 1 || !isNonEmptyString(terrainId)) {
            throw new InvalidChapterDataError('terrain legend keys must be one character and values must be non-empty strings');
        }
        if (!isRecord(chapter.terrain[terrainId])) {
            throw new InvalidChapterDataError(`terrain legend code "${code}" references unknown terrain "${terrainId}"`);
        }
    }
    for (const code of new Set(tiles.flatMap((row) => [...row]))) {
        if (!Object.prototype.hasOwnProperty.call(terrainLegend, code)) {
            throw new InvalidChapterDataError(`map uses terrain code "${code}" which is missing from the terrain legend`);
        }
    }

    if (!Array.isArray(chapter.units)) {
        throw new InvalidChapterDataError('"units" must be an array');
    }
    const unitIds = new Set<string>();
    const occupiedTiles = new Map<string, string>();
    for (const unit of chapter.units) {
        if (!isRecord(unit) || !isNonEmptyString(unit.id)) {
            throw new InvalidChapterDataError('every unit must be an object with a non-empty "id"');
        }
        if (unitIds.has(unit.id)) {
            throw new InvalidChapterDataError(`duplicate unit id "${unit.id}"`);
        }
        unitIds.add(unit.id);

        if (!isNonEmptyString(unit.name) || !isNonEmptyString(unit.classId)) {
            throw new InvalidChapterDataError(`unit "${unit.id}" must have non-empty "name" and "classId" values`);
        }
        if (unit.faction !== 'player' && unit.faction !== 'enemy') {
            throw new InvalidChapterDataError(`unit "${unit.id}" has invalid faction "${String(unit.faction)}"`);
        }
        if (!isMapCoordinate(unit.x) || !isMapCoordinate(unit.y) || unit.x >= width || unit.y >= height) {
            throw new InvalidChapterDataError(`unit "${unit.id}" is outside the ${width}x${height} map at (${unit.x}, ${unit.y})`);
        }
        const tileKey = `${unit.x},${unit.y}`;
        const occupyingUnitId = occupiedTiles.get(tileKey);
        if (occupyingUnitId !== undefined) {
            throw new InvalidChapterDataError(
                `units "${occupyingUnitId}" and "${unit.id}" occupy the same tile (${unit.x}, ${unit.y})`
            );
        }
        occupiedTiles.set(tileKey, unit.id);

        if (!isRecord(unit.stats)
            || typeof unit.stats.hp !== 'number'
            || typeof unit.stats.maxHp !== 'number'
            || unit.stats.maxHp <= 0
            || unit.stats.hp < 0
            || unit.stats.hp > unit.stats.maxHp) {
            throw new InvalidChapterDataError(`unit "${unit.id}" must have hp between 0 and a positive maxHp`);
        }
        if (!isRecord(unit.weapon)
            || !isNonEmptyString(unit.weapon.id)
            || !Number.isInteger(unit.weapon.minRange)
            || !Number.isInteger(unit.weapon.maxRange)
            || unit.weapon.minRange <= 0
            || unit.weapon.maxRange < unit.weapon.minRange) {
            throw new InvalidChapterDataError(`unit "${unit.id}" has invalid weapon range data`);
        }
    }
}

/** Validates the shape and cross-document references of all chapter hook event scripts. */
export function validateHookScripts(chapter: ChapterData, scripts: EventScript[]): void {
    const unitIds = new Set(chapter.units.map((unit) => unit.id));

    for (const script of scripts) {
        if (!isRecord(script) || !isNonEmptyString(script.id)) {
            throw new InvalidHookScriptError('every hook must be an object with a non-empty "id"');
        }
        if (!Array.isArray(script.events)) {
            throw new InvalidHookScriptError(`hook "${script.id}" must have an "events" array`);
        }

        for (const event of script.events) {
            validateEvent(script.id, event, unitIds, chapter.map.width, chapter.map.height);
        }
    }
}

function validateEvent(
    scriptId: string,
    event: GameEvent,
    unitIds: Set<string>,
    mapWidth: number,
    mapHeight: number
): void {
    if (!isRecord(event) || !isNonEmptyString(event.id)) {
        throw new InvalidHookScriptError(`hook "${scriptId}" contains an event without a non-empty "id"`);
    }
    if (!isRecord(event.trigger) || !isNonEmptyString(event.trigger.type) || !TRIGGER_TYPES.has(event.trigger.type as Trigger['type'])) {
        throw new InvalidHookScriptError(`event "${event.id}" has an invalid trigger type`);
    }
    if (!Array.isArray(event.actions)) {
        throw new InvalidHookScriptError(`event "${event.id}" must have an "actions" array`);
    }
    if (event.once !== undefined && typeof event.once !== 'boolean') {
        throw new InvalidHookScriptError(`event "${event.id}" must have a boolean "once" when provided`);
    }

    validateTriggerPayload(event.id, event.trigger);
    validateCoordinateReference(event.id, 'trigger', event.trigger, mapWidth, mapHeight);
    validateUnitReference(
        event.id,
        'trigger',
        event.trigger,
        unitIds,
        event.trigger.type === 'unit_dead' || event.trigger.type === 'recruitment'
    );

    for (const action of event.actions) {
        if (!isRecord(action) || !isNonEmptyString(action.type)) {
            throw new InvalidHookScriptError(`event "${event.id}" contains an action without a non-empty "type"`);
        }
        validateCoordinateReference(event.id, `action "${action.type}"`, action, mapWidth, mapHeight);
        if (UNIT_ACTION_TYPES.has(action.type)) {
            validateUnitReference(event.id, `action "${action.type}"`, action, unitIds, true);
        }
        if (action.type === 'dialogue') {
            validateDialogueAction(event.id, action);
        }
    }
}

function validateTriggerPayload(eventId: string, trigger: Record<string, unknown>): void {
    switch (trigger.type) {
        case 'turn':
            if (!Number.isInteger(trigger.turn) || (trigger.turn as number) <= 0) {
                throw new InvalidHookScriptError(`event "${eventId}" turn trigger must have a positive integer "turn"`);
            }
            if (trigger.faction !== undefined && trigger.faction !== 'player' && trigger.faction !== 'enemy') {
                throw new InvalidHookScriptError(`event "${eventId}" turn trigger has an invalid "faction"`);
            }
            break;
        case 'house':
            if (!isNonEmptyString(trigger.houseId)) {
                throw new InvalidHookScriptError(`event "${eventId}" house trigger must have a non-empty "houseId"`);
            }
            break;
        case 'village':
            if (!isNonEmptyString(trigger.villageId)) {
                throw new InvalidHookScriptError(`event "${eventId}" village trigger must have a non-empty "villageId"`);
            }
            break;
        case 'variable_change':
            if (!isVariableRef(trigger.variable)) {
                throw new InvalidHookScriptError(`event "${eventId}" variable_change trigger has an invalid "variable"`);
            }
            break;
    }
}

function validateDialogueAction(eventId: string, action: Record<string, unknown>): void {
    if (action.dialogueRef !== undefined) {
        if (!isNonEmptyString(action.dialogueRef)) {
            throw new InvalidHookScriptError(`event "${eventId}" dialogue action has an invalid "dialogueRef"`);
        }
        return;
    }

    if (!Array.isArray(action.lines)
        || action.lines.length === 0
        || action.lines.some((line) => typeof line !== 'string')) {
        throw new InvalidHookScriptError(
            `event "${eventId}" dialogue action must have a "dialogueRef" or a non-empty string "lines" array`
        );
    }
}

function validateCoordinateReference(
    eventId: string,
    source: string,
    payload: Record<string, unknown>,
    mapWidth: number,
    mapHeight: number
): void {
    if (payload.type !== 'arrival' && payload.type !== 'spawn') {
        return;
    }
    if (!isMapCoordinate(payload.x) || !isMapCoordinate(payload.y) || payload.x >= mapWidth || payload.y >= mapHeight) {
        throw new InvalidHookScriptError(
            `event "${eventId}" ${source} has out-of-bounds coordinates (${payload.x}, ${payload.y})`
        );
    }
}

function validateUnitReference(
    eventId: string,
    source: string,
    payload: Record<string, unknown>,
    unitIds: Set<string>,
    required: boolean
): void {
    const referencedUnitId = payload.unitId;
    if ((required || referencedUnitId !== undefined)
        && (!isNonEmptyString(referencedUnitId) || !unitIds.has(referencedUnitId))) {
        throw new InvalidHookScriptError(
            `event "${eventId}" ${source} references unknown unit id "${String(referencedUnitId)}"`
        );
    }
}

/**
 * Cross-checks event scripts against the chapter's unit roster: any `unitId` referenced by a
 * `unit_dead`, `boss_dead`, `arrival`, `recruitment`, `recruit`, `give_item` or `spawn` payload
 * must exist among `chapter.units`, unless the payload is generic (e.g. a boss_dead with no unitId).
 */
export function validateHookUnitReferences(chapter: ChapterData, scripts: EventScript[]): void {
    validateHookScripts(chapter, scripts);
}

/** Merges hook scripts (in phase order) into a single {@link EventScript}, rejecting duplicate event ids. */
export function mergeEventScripts(id: string, scripts: EventScript[]): EventScript {
    const seenIds = new Set<string>();
    const events = scripts.flatMap((script) => script.events);

    for (const event of events) {
        if (!isNonEmptyString(event.id)) {
            throw new InvalidHookScriptError('every event must have a non-empty "id"');
        }
        if (seenIds.has(event.id)) {
            throw new DuplicateHookEventIdError(event.id);
        }
        seenIds.add(event.id);
    }

    return { id, events };
}
