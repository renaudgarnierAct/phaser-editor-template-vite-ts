import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem, QUICK_SAVE_SLOT_ID } from '../SaveSystem.ts';
import { CorruptedSaveError, ReservedSlotIdError, SlotNotFoundError, UnsupportedVersionError } from '../errors.ts';
import { MemoryStorage } from './MemoryStorage.ts';

interface TestPayload {
    counter: number;
}

function makeSystem(storage = new MemoryStorage(), currentVersion = 1, migrations = {}) {
    return new SaveSystem<TestPayload>({
        currentVersion,
        migrations,
        storage,
        namespace: 'test',
        validatePayload: (payload) => {
            if (typeof payload !== 'object' || payload === null || typeof (payload as TestPayload).counter !== 'number') {
                throw new Error('counter must be a number');
            }
            return { counter: (payload as TestPayload).counter };
        }
    });
}

test('quickSave then loadQuickSave round-trips the payload', () => {
    const system = makeSystem();
    system.quickSave({ counter: 42 });
    assert.deepEqual(system.loadQuickSave(), { counter: 42 });
    assert.equal(system.hasQuickSave(), true);
});

test('loadQuickSave throws SlotNotFoundError when nothing was saved', () => {
    const system = makeSystem();
    assert.throws(() => system.loadQuickSave(), SlotNotFoundError);
    assert.equal(system.hasQuickSave(), false);
});

test('save/load round-trips a named normal slot independently from the quick slot', () => {
    const system = makeSystem();
    system.save('slot-1', { counter: 1 });
    system.quickSave({ counter: 99 });

    assert.deepEqual(system.load('slot-1'), { counter: 1 });
    assert.deepEqual(system.loadQuickSave(), { counter: 99 });
});

test('save/load/hasSave/deleteSlot reject the reserved quick-save slot id', () => {
    const system = makeSystem();
    assert.throws(() => system.save(QUICK_SAVE_SLOT_ID, { counter: 1 }), ReservedSlotIdError);
    assert.throws(() => system.load(QUICK_SAVE_SLOT_ID), ReservedSlotIdError);
    assert.throws(() => system.hasSave(QUICK_SAVE_SLOT_ID), ReservedSlotIdError);
});

test('deleteSlot removes a save and is a no-op when nothing exists', () => {
    const system = makeSystem();
    system.save('slot-1', { counter: 1 });
    system.deleteSlot('slot-1');
    assert.equal(system.hasSave('slot-1'), false);
    assert.doesNotThrow(() => system.deleteSlot('slot-1'));
});

test('listSlots reports both quick and normal saves, most recent first', () => {
    const storage = new MemoryStorage();
    const system = makeSystem(storage);
    system.save('slot-1', { counter: 1 });
    system.quickSave({ counter: 2 });

    const slots = system.listSlots();
    assert.equal(slots.length, 2);
    assert.deepEqual(new Set(slots.map((s) => s.slotId)), new Set(['slot-1', QUICK_SAVE_SLOT_ID]));
});

test('load throws CorruptedSaveError for malformed stored JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('test:slot-1', 'not json');
    const system = makeSystem(storage);
    assert.throws(() => system.load('slot-1'), CorruptedSaveError);
});

test('load throws CorruptedSaveError when payload fails validation', () => {
    const storage = new MemoryStorage();
    storage.setItem('test:slot-1', JSON.stringify({ version: 1, kind: 'normal', savedAt: 'x', payload: { counter: 'nope' } }));
    const system = makeSystem(storage);
    assert.throws(() => system.load('slot-1'), CorruptedSaveError);
});

test('load throws UnsupportedVersionError when the stored version is newer than supported', () => {
    const storage = new MemoryStorage();
    storage.setItem('test:slot-1', JSON.stringify({ version: 5, kind: 'normal', savedAt: 'x', payload: { counter: 1 } }));
    const system = makeSystem(storage, 1);
    assert.throws(() => system.load('slot-1'), UnsupportedVersionError);
});

test('load applies registered migrations to bring an old save up to the current version', () => {
    const storage = new MemoryStorage();
    storage.setItem(
        'test:slot-1',
        JSON.stringify({ version: 1, kind: 'normal', savedAt: 'x', payload: { counter: 1 } })
    );
    const system = makeSystem(storage, 2, {
        1: (payload: unknown) => ({ counter: (payload as TestPayload).counter + 100 })
    });

    assert.deepEqual(system.load('slot-1'), { counter: 101 });
});

test('constructor rejects a non-positive currentVersion', () => {
    assert.throws(() => makeSystem(new MemoryStorage(), 0));
});
