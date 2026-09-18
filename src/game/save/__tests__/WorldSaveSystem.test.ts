import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldSaveSystem, WORLD_SAVE_VERSION } from '../WorldSaveSystem.ts';
import { MemoryStorage } from './MemoryStorage.ts';

test('createWorldSaveSystem round-trips a world progress state', () => {
    const storage = new MemoryStorage();
    const system = createWorldSaveSystem({ storage });

    const progress = { completedChapterIds: ['ch-1'], currentNodeId: 'node:2', flags: { met_king: true } };
    system.save('slot-1', progress);

    assert.deepEqual(system.load('slot-1'), progress);
});

test('createWorldSaveSystem migrates a legacy v1 save (no flags) up to the current version', () => {
    const storage = new MemoryStorage();
    storage.setItem(
        'world-progress:slot-1',
        JSON.stringify({
            version: 1,
            kind: 'normal',
            savedAt: new Date(0).toISOString(),
            payload: { completedChapterIds: ['ch-1'], currentNodeId: 'node:2' }
        })
    );

    const system = createWorldSaveSystem({ storage });
    const loaded = system.load('slot-1');

    assert.deepEqual(loaded, { completedChapterIds: ['ch-1'], currentNodeId: 'node:2', flags: {} });
});

test('WORLD_SAVE_VERSION is a positive integer', () => {
    assert.ok(Number.isInteger(WORLD_SAVE_VERSION) && WORLD_SAVE_VERSION >= 1);
});
