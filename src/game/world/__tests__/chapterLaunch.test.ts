import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChapterLaunchData } from '../chapterLaunch.ts';
import type { WorldNodeData } from '../types.ts';

test('createChapterLaunchData forwards the selected chapter and world node references', () => {
    const node: WorldNodeData = {
        id: 'node:prologue',
        chapterId: 'chapter-01',
        name: 'Prologue',
        x: 0,
        y: 0,
        connections: [],
        unlock: { type: 'always' }
    };

    assert.deepEqual(createChapterLaunchData(node), {
        chapterId: 'chapter-01',
        worldNodeId: 'node:prologue'
    });
});
