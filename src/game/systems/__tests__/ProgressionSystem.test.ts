import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClassDefinition } from '../../data/classes.ts';
import { createStatBlock } from '../../data/stats.ts';
import {
    addExperience,
    computeExperienceGain,
    createUnitProgress,
    promote,
    rollStatGrowth,
    XP_PER_LEVEL
} from '../ProgressionSystem.ts';

function makeClass(overrides: Partial<ClassDefinition> = {}): ClassDefinition {
    return {
        id: 'class:test',
        name: 'Test',
        baseStats: { ...createStatBlock(10), con: 8 },
        growths: { ...createStatBlock(50), con: 0 },
        statCaps: { ...createStatBlock(30), con: 12 },
        movement: 5,
        usableWeaponTypes: { sword: 'E' },
        ...overrides
    };
}

test('createUnitProgress starts at level 1 with 0 xp and the class base stats', () => {
    const classDefinition = makeClass();
    const progress = createUnitProgress(classDefinition);

    assert.equal(progress.level, 1);
    assert.equal(progress.xp, 0);
    assert.deepEqual(progress.stats, classDefinition.baseStats);
});

test('rollStatGrowth grants +1 to a stat only when rng is below its growth chance', () => {
    const classDefinition = makeClass({ growths: { ...createStatBlock(0), hp: 60, con: 0 } });

    const belowThreshold = rollStatGrowth(classDefinition, () => 0.5);
    assert.equal(belowThreshold.hp, 1);

    const aboveThreshold = rollStatGrowth(classDefinition, () => 0.9);
    assert.equal(aboveThreshold.hp, undefined);
});

test('addExperience accumulates xp without leveling below the 100 xp threshold', () => {
    const classDefinition = makeClass();
    const progress = createUnitProgress(classDefinition);

    const result = addExperience(progress, classDefinition, 40, () => 1);

    assert.equal(result.levelsGained, 0);
    assert.equal(result.progress.xp, 40);
    assert.equal(result.progress.level, 1);
});

test('addExperience levels up once per 100 xp and rolls growth for each level', () => {
    const classDefinition = makeClass({ growths: { ...createStatBlock(100), con: 0 } });
    const progress = createUnitProgress(classDefinition);

    // rng() = 0 always succeeds every growth roll (chance is 100/100 = 1, and 0 < 1).
    const result = addExperience(progress, classDefinition, 250, () => 0);

    assert.equal(result.levelsGained, 2);
    assert.equal(result.progress.level, 3);
    assert.equal(result.progress.xp, 50);
    assert.equal(result.progress.stats.hp, classDefinition.baseStats.hp + 2);
    assert.equal(result.totalGains.hp, 2);
});

test('addExperience clamps stat growth to the class stat caps', () => {
    const classDefinition = makeClass({
        baseStats: { ...createStatBlock(29), con: 8 },
        statCaps: { ...createStatBlock(30), con: 12 },
        growths: { ...createStatBlock(100), con: 0 }
    });
    const progress = createUnitProgress(classDefinition);

    const result = addExperience(progress, classDefinition, XP_PER_LEVEL * 3, () => 0);

    assert.equal(result.progress.stats.hp, 30);
});

test('addExperience throws on negative xp', () => {
    const classDefinition = makeClass();
    const progress = createUnitProgress(classDefinition);
    assert.throws(() => addExperience(progress, classDefinition, -1));
});

test('promote switches class, applies the promotion bonus and clamps to the new caps', () => {
    const baseClass = makeClass({
        id: 'class:soldier',
        promotesTo: ['class:knight'],
        promotionBonus: { hp: 5, def: 5 }
    });
    const promotedClass = makeClass({ id: 'class:knight', statCaps: { ...createStatBlock(30), def: 12, con: 12 } });
    const progress = createUnitProgress(baseClass);

    const promoted = promote(progress, baseClass, promotedClass);

    assert.equal(promoted.classId, 'class:knight');
    assert.equal(promoted.stats.hp, 15);
    assert.equal(promoted.stats.def, 12);
});

test('promote throws if the target class is not a valid promotion path', () => {
    const baseClass = makeClass({ promotesTo: ['class:knight'] });
    const otherClass = makeClass({ id: 'class:mage' });
    const progress = createUnitProgress(baseClass);

    assert.throws(() => promote(progress, baseClass, otherClass));
});

test('computeExperienceGain grants more xp against higher level foes and less against lower level ones', () => {
    const even = computeExperienceGain({ attackerLevel: 5, defenderLevel: 5, defeated: false });
    const strongerFoe = computeExperienceGain({ attackerLevel: 5, defenderLevel: 10, defeated: false });
    const weakerFoe = computeExperienceGain({ attackerLevel: 15, defenderLevel: 3, defeated: false });

    assert.ok(strongerFoe > even);
    assert.ok(weakerFoe < even);
    assert.ok(weakerFoe >= 1, 'xp gain never drops below the configured minimum');
});

test('computeExperienceGain grants a kill bonus for defeating a target', () => {
    const withoutKill = computeExperienceGain({ attackerLevel: 5, defenderLevel: 5, defeated: false });
    const withKill = computeExperienceGain({ attackerLevel: 5, defenderLevel: 5, defeated: true });

    assert.equal(withKill, withoutKill + 20);
});
