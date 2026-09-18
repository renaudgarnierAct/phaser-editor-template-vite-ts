import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorldMapData } from '../types.ts';
import {
    completeChapter,
    createInitialProgress,
    getAvailableNextNodes,
    isNodeUnlocked,
    selectNextChapter,
    setFlag
} from '../WorldMapSystem.ts';
import { AmbiguousChapterSelectionError, ChapterNotAvailableError, NoAvailableChapterError, UnknownNodeError } from '../errors.ts';
import { validateWorldMap } from '../loadWorldMap.ts';

function makeMap(): WorldMapData {
    return {
        id: 'world:test',
        name: 'Test World',
        startNodeId: 'a',
        nodes: [
            { id: 'a', chapterId: 'ch-a', name: 'A', x: 0, y: 0, connections: ['b', 'c'], unlock: { type: 'always' } },
            {
                id: 'b',
                chapterId: 'ch-b',
                name: 'B',
                x: 1,
                y: 0,
                connections: ['d'],
                unlock: { type: 'chapterCompleted', chapterId: 'ch-a' }
            },
            {
                id: 'c',
                chapterId: 'ch-c',
                name: 'C',
                x: 1,
                y: 1,
                connections: ['d'],
                unlock: { type: 'flag', flag: 'found-secret' }
            },
            {
                id: 'd',
                chapterId: 'ch-d',
                name: 'D',
                x: 2,
                y: 0,
                connections: [],
                unlock: { type: 'anyOf', conditions: [{ type: 'chapterCompleted', chapterId: 'ch-b' }, { type: 'chapterCompleted', chapterId: 'ch-c' }] }
            }
        ]
    };
}

test('createInitialProgress starts at the map start node with nothing completed', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);

    assert.equal(progress.currentNodeId, 'a');
    assert.deepEqual(progress.completedChapterIds, []);
    assert.deepEqual(progress.flags, {});
});

test('isNodeUnlocked evaluates chapterCompleted and flag conditions', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);

    assert.equal(isNodeUnlocked(map.nodes[0], progress), true);
    assert.equal(isNodeUnlocked(map.nodes[1], progress), false);

    const withFlag = setFlag(progress, 'found-secret');
    assert.equal(isNodeUnlocked(map.nodes[2], withFlag), true);
});

test('getAvailableNextNodes only returns unlocked connections from the current node', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);

    assert.deepEqual(getAvailableNextNodes(map, progress).map((n) => n.id), []);

    const afterA = completeChapter(map, progress, 'ch-a', 'a');
    assert.deepEqual(getAvailableNextNodes(map, afterA).map((n) => n.id), ['b']);
});

test('selectNextChapter auto-selects the single available node', () => {
    const map = makeMap();
    const progress = completeChapter(map, createInitialProgress(map), 'ch-a', 'a');

    const selected = selectNextChapter(map, progress);
    assert.equal(selected.id, 'b');
});

test('selectNextChapter throws AmbiguousChapterSelectionError when several nodes are available', () => {
    const map = makeMap();
    let progress = createInitialProgress(map);
    progress = completeChapter(map, progress, 'ch-a', 'a');
    progress = setFlag(progress, 'found-secret');
    // Both b (chapterCompleted ch-a) and c (flag found-secret) are now unlocked from 'a'.
    assert.throws(() => selectNextChapter(map, progress), AmbiguousChapterSelectionError);
});

test('selectNextChapter throws NoAvailableChapterError when nothing is unlocked', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);
    assert.throws(() => selectNextChapter(map, progress), NoAvailableChapterError);
});

test('selectNextChapter throws ChapterNotAvailableError for a locked explicit nodeId', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);
    assert.throws(() => selectNextChapter(map, progress, 'b'), ChapterNotAvailableError);
});

test('selectNextChapter throws UnknownNodeError for a nonexistent explicit nodeId', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);
    assert.throws(() => selectNextChapter(map, progress, 'nope'), UnknownNodeError);
});

test('completeChapter is idempotent on the completed chapter list and moves the current node', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);

    const once = completeChapter(map, progress, 'ch-a', 'a');
    const twice = completeChapter(map, once, 'ch-a', 'a');

    assert.deepEqual(twice.completedChapterIds, ['ch-a']);
    assert.equal(twice.currentNodeId, 'a');
});

test('completeChapter throws UnknownNodeError for an invalid arrival node', () => {
    const map = makeMap();
    const progress = createInitialProgress(map);
    assert.throws(() => completeChapter(map, progress, 'ch-a', 'nope'), UnknownNodeError);
});

test('validateWorldMap accepts a well-formed map', () => {
    assert.doesNotThrow(() => validateWorldMap(makeMap()));
});

test('validateWorldMap rejects duplicate node ids', () => {
    const map = makeMap();
    map.nodes.push({ ...map.nodes[0] });
    assert.throws(() => validateWorldMap(map));
});

test('validateWorldMap rejects an unknown startNodeId', () => {
    const map = makeMap();
    map.startNodeId = 'nope';
    assert.throws(() => validateWorldMap(map));
});

test('validateWorldMap rejects a connection pointing to a nonexistent node', () => {
    const map = makeMap();
    map.nodes[0].connections.push('nope');
    assert.throws(() => validateWorldMap(map));
});
