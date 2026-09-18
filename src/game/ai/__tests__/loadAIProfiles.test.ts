import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAIChapterFile, resolveAIProfile } from '../loadAIProfiles.ts';

test('parseAIChapterFile builds a profile map keyed by unit id', () => {
    const profiles = parseAIChapterFile({
        chapterId: 'chapter:test',
        units: [
            { unitId: 'unit:guard', behavior: 'guard', guardPoint: { x: 1, y: 2 }, guardRadius: 3 },
            { unitId: 'unit:brigand', behavior: 'aggressive' }
        ]
    });

    assert.equal(profiles.size, 2);
    assert.deepEqual(profiles.get('unit:guard'), { behavior: 'guard', guardPoint: { x: 1, y: 2 }, guardRadius: 3 });
    assert.deepEqual(profiles.get('unit:brigand'), { behavior: 'aggressive' });
});

test('parseAIChapterFile rejects a payload missing chapterId/units', () => {
    assert.throws(() => parseAIChapterFile({ units: [] }));
    assert.throws(() => parseAIChapterFile({ chapterId: 'chapter:test' }));
    assert.throws(() => parseAIChapterFile(null));
});

test('parseAIChapterFile rejects a unit entry missing unitId or behavior', () => {
    assert.throws(() => parseAIChapterFile({ chapterId: 'chapter:test', units: [{ behavior: 'guard' }] }));
    assert.throws(() => parseAIChapterFile({ chapterId: 'chapter:test', units: [{ unitId: 'unit:x' }] }));
});

test('resolveAIProfile falls back to the default behavior when a unit has no entry', () => {
    const profiles = parseAIChapterFile({ chapterId: 'chapter:test', units: [{ unitId: 'unit:a', behavior: 'boss' }] });

    assert.deepEqual(resolveAIProfile('unit:a', profiles), { behavior: 'boss' });
    assert.deepEqual(resolveAIProfile('unit:missing', profiles), { behavior: 'aggressive' });
    assert.deepEqual(resolveAIProfile('unit:missing', profiles, 'guard'), { behavior: 'guard' });
});
