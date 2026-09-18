import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ChapterData } from '../../data/types.ts';
import type { ChapterManifest, DialogueCatalog } from '../types.ts';
import type { EventScript } from '../../events/types.ts';
import { buildChapterContent } from '../loadChapterContent.ts';
import { validateDialogueCatalog, resolveDialogueRefs } from '../dialogueCatalog.ts';
import {
    mergeEventScripts,
    validateChapterData,
    validateChapterManifest,
    validateHookUnitReferences
} from '../validate.ts';
import {
    DuplicateHookEventIdError,
    InvalidChapterDataError,
    InvalidChapterManifestError,
    InvalidDialogueCatalogError,
    InvalidHookScriptError,
    UnknownDialogueRefError
} from '../errors.ts';
import { EventEngine } from '../../events/EventEngine.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDataDir = path.resolve(here, '../../../../public/data');

function readJson<T>(fileName: string): T {
    return JSON.parse(readFileSync(path.join(publicDataDir, fileName), 'utf-8')) as T;
}

function loadDemoContent() {
    const manifest = readJson<ChapterManifest>('chapter-demo.manifest.json');
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const dialogueCatalog = readJson<DialogueCatalog>('dialogues-demo.json');
    const preChapter = readJson<EventScript>('events-demo-pre.json');
    const duringChapter = readJson<EventScript>('events-demo-during.json');
    const postChapter = readJson<EventScript>('events-demo-post.json');

    return buildChapterContent(manifest, chapter, dialogueCatalog, { preChapter, duringChapter, postChapter });
}

test('the bundled demo chapter manifest resolves into a valid, combined ChapterContent', () => {
    const content = loadDemoContent();

    assert.equal(content.id, 'chapter:demo');
    assert.ok(content.chapter.units.length > 0);
    assert.ok(content.combinedScript.events.length > 0);

    // Every dialogue action must have been resolved from a dialogueRef into inline lines.
    for (const event of content.combinedScript.events) {
        for (const action of event.actions) {
            if (action.type === 'dialogue') {
                assert.ok(Array.isArray(action.lines) && action.lines.length > 0);
            }
        }
    }
});

test('the demo chapter drives a full pre/during/post hook lifecycle through the real EventEngine', () => {
    const content = loadDemoContent();
    const engine = new EventEngine();
    engine.loadScript(content.combinedScript);

    // Pre-chapter hook.
    const chapterStart = engine.dispatch({ type: 'chapter_start' });
    assert.equal(chapterStart.length, 1);
    assert.equal(chapterStart[0].eventId, 'event:demo:pre_chapter_dialogue');

    // House: information + reward.
    const house = engine.dispatch({ type: 'house', houseId: 'house:demo_house_1' });
    assert.equal(house.length, 1);
    assert.equal(engine.variables.get('chapter', 'house_1_visited'), true);

    // Village: destroyed before being visited blocks the reward event.
    engine.dispatch({ type: 'arrival', x: 3, y: 5, unitId: 'unit:enemy_2' });
    assert.equal(engine.variables.get('chapter', 'village_1_destroyed'), true);

    const villageAfterDestruction = engine.dispatch({ type: 'village', villageId: 'village:demo_village_1' });
    assert.equal(villageAfterDestruction.length, 0);
    assert.notEqual(engine.variables.get('chapter', 'village_1_visited'), true);

    // Conditional recruitment: recruiting without the dialogue hook first does nothing.
    const recruitBeforeHook = engine.dispatch({ type: 'recruitment', unitId: 'unit:enemy_1' });
    assert.equal(recruitBeforeHook.length, 0);

    engine.dispatch({ type: 'arrival', x: 6, y: 2, unitId: 'unit:player_1' });
    assert.equal(engine.variables.get('chapter', 'recruit_1_unlocked'), true);

    const recruitAfterHook = engine.dispatch({ type: 'recruitment', unitId: 'unit:enemy_1' });
    assert.equal(recruitAfterHook.length, 1);

    // Boss death ends the chapter and flips the outcome variable...
    const bossDead = engine.dispatch({ type: 'boss_dead', unitId: 'unit:enemy_boss' });
    assert.equal(bossDead.length, 1);
    const endChapterEffect = bossDead[0].effects.find((effect) => effect.action.type === 'end_chapter');
    assert.ok(endChapterEffect);

    // ...which cascades into the post-chapter hook via variable_change.
    assert.equal(engine.variables.get('campaign', 'demo_chapter_completed'), true);
});

test('the village reward fires normally when visited before being destroyed', () => {
    const content = loadDemoContent();
    const engine = new EventEngine();
    engine.loadScript(content.combinedScript);

    const village = engine.dispatch({ type: 'village', villageId: 'village:demo_village_1' });
    assert.equal(village.length, 1);
    assert.equal(engine.variables.get('chapter', 'village_1_visited'), true);

    // Destruction no longer applies once the village has already been visited/rewarded.
    engine.dispatch({ type: 'arrival', x: 3, y: 5, unitId: 'unit:enemy_2' });
    assert.notEqual(engine.variables.get('chapter', 'village_1_destroyed'), true);
});

test('validateDialogueCatalog rejects duplicate entry ids', () => {
    const catalog: DialogueCatalog = {
        id: 'dialogues:test',
        entries: [
            { id: 'dialogue:a', lines: ['x'] },
            { id: 'dialogue:a', lines: ['y'] }
        ]
    };

    assert.throws(() => validateDialogueCatalog(catalog));
});

test('validateDialogueCatalog rejects malformed catalog roots with an explicit error', () => {
    assert.throws(
        () => validateDialogueCatalog({ id: 'dialogues:test' } as DialogueCatalog),
        (error: unknown) => error instanceof InvalidDialogueCatalogError && error.message.includes('"entries" must be an array')
    );
});

test('resolveDialogueRefs throws UnknownDialogueRefError for a missing reference', () => {
    const script: EventScript = {
        id: 'events:test',
        events: [
            { id: 'event:test', trigger: { type: 'chapter_start' }, actions: [{ type: 'dialogue', dialogueRef: 'dialogue:missing' } as never] }
        ]
    };
    const catalog: DialogueCatalog = { id: 'dialogues:test', entries: [] };

    assert.throws(() => resolveDialogueRefs(script, catalog), UnknownDialogueRefError);
});

test('mergeEventScripts rejects duplicate event ids across hook phases', () => {
    const a: EventScript = { id: 'a', events: [{ id: 'dup', trigger: { type: 'chapter_start' }, actions: [] }] };
    const b: EventScript = { id: 'b', events: [{ id: 'dup', trigger: { type: 'chapter_start' }, actions: [] }] };

    assert.throws(() => mergeEventScripts('combined', [a, b]), DuplicateHookEventIdError);
});

test('validateHookUnitReferences rejects a trigger pointing at an unknown unit id', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const script: EventScript = {
        id: 'events:test',
        events: [{ id: 'event:test', trigger: { type: 'unit_dead', unitId: 'unit:nonexistent' }, actions: [] }]
    };

    assert.throws(
        () => validateHookUnitReferences(chapter, [script]),
        (error: unknown) => error instanceof InvalidHookScriptError && error.message.includes('unit:nonexistent')
    );
});

test('validateChapterManifest rejects empty hook references', () => {
    const manifest = readJson<ChapterManifest>('chapter-demo.manifest.json');
    manifest.hooks.duringChapter = '';

    assert.throws(
        () => validateChapterManifest(manifest),
        (error: unknown) => error instanceof InvalidChapterManifestError && error.message.includes('hooks.duringChapter')
    );
});

test('buildChapterContent rejects a chapter id that does not match its manifest', () => {
    const manifest = readJson<ChapterManifest>('chapter-demo.manifest.json');
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const content = loadDemoContent();
    chapter.id = 'chapter:other';

    assert.throws(
        () => buildChapterContent(manifest, chapter, content.dialogueCatalog, content.hooks),
        (error: unknown) => error instanceof InvalidChapterDataError && error.message.includes('does not match manifest id')
    );
});

test('validateChapterData rejects rows whose width differs from the declared map width', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    chapter.map.tiles[0] = 'P';

    assert.throws(
        () => validateChapterData(chapter),
        (error: unknown) => error instanceof InvalidChapterDataError && error.message.includes('map row 0')
    );
});

test('validateChapterData rejects terrain codes missing from the legend', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    chapter.map.tiles[0] = `X${chapter.map.tiles[0].slice(1)}`;

    assert.throws(
        () => validateChapterData(chapter),
        (error: unknown) => error instanceof InvalidChapterDataError && error.message.includes('terrain code "X"')
    );
});

test('validateChapterData rejects duplicate unit ids and occupied tiles', () => {
    const duplicateIdChapter = readJson<ChapterData>('chapter-demo.json');
    duplicateIdChapter.units[1].id = duplicateIdChapter.units[0].id;
    assert.throws(() => validateChapterData(duplicateIdChapter), /duplicate unit id/);

    const occupiedTileChapter = readJson<ChapterData>('chapter-demo.json');
    occupiedTileChapter.units[1].x = occupiedTileChapter.units[0].x;
    occupiedTileChapter.units[1].y = occupiedTileChapter.units[0].y;
    assert.throws(() => validateChapterData(occupiedTileChapter), /occupy the same tile/);
});

test('hook validation rejects unknown action unit references', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const script: EventScript = {
        id: 'events:test',
        events: [{
            id: 'event:test',
            trigger: { type: 'chapter_start' },
            actions: [{ type: 'give_item', unitId: 'unit:nonexistent', itemId: 'item:test' }]
        }]
    };

    assert.throws(
        () => validateHookUnitReferences(chapter, [script]),
        (error: unknown) => error instanceof InvalidHookScriptError
            && error.message.includes('action "give_item"')
            && error.message.includes('unit:nonexistent')
    );
});

test('hook validation rejects event coordinates outside the chapter map', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const script: EventScript = {
        id: 'events:test',
        events: [{
            id: 'event:test',
            trigger: { type: 'arrival', x: chapter.map.width, y: 0 },
            actions: []
        }]
    };

    assert.throws(
        () => validateHookUnitReferences(chapter, [script]),
        (error: unknown) => error instanceof InvalidHookScriptError && error.message.includes('out-of-bounds coordinates')
    );
});

test('hook validation rejects malformed event payloads before EventEngine execution', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const script: EventScript = {
        id: 'events:test',
        events: [{
            id: 'event:test',
            trigger: { type: 'unit_dead' } as never,
            actions: []
        }]
    };

    assert.throws(
        () => validateHookUnitReferences(chapter, [script]),
        (error: unknown) => error instanceof InvalidHookScriptError && error.message.includes('"undefined"')
    );
});

test('hook validation rejects dialogue actions without a reference or inline lines', () => {
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const script: EventScript = {
        id: 'events:test',
        events: [{
            id: 'event:test',
            trigger: { type: 'chapter_start' },
            actions: [{ type: 'dialogue' }]
        }]
    };

    assert.throws(
        () => validateHookUnitReferences(chapter, [script]),
        (error: unknown) => error instanceof InvalidHookScriptError && error.message.includes('"dialogueRef"')
    );
});

test('buildChapterContent rejects dialogue references when no catalog is declared', () => {
    const manifest = readJson<ChapterManifest>('chapter-demo.manifest.json');
    delete manifest.dialogueCatalogRef;
    const chapter = readJson<ChapterData>('chapter-demo.json');
    const preChapter = readJson<EventScript>('events-demo-pre.json');
    const duringChapter = readJson<EventScript>('events-demo-during.json');
    const postChapter = readJson<EventScript>('events-demo-post.json');

    assert.throws(
        () => buildChapterContent(manifest, chapter, undefined, { preChapter, duringChapter, postChapter }),
        UnknownDialogueRefError
    );
});
