import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDeathProbability, forecastCombat } from '../damage.ts';
import { makeUnit } from './testUtils.ts';

test('forecastCombat computes expected damage and lethality for a simple 1v1', () => {
    const attacker = makeUnit({ id: 'unit:a', x: 0, y: 0, stats: { hp: 20, maxHp: 20, attack: 10, defense: 3, speed: 6, luck: 0 } });
    const defender = makeUnit({
        id: 'unit:b',
        x: 1,
        y: 0,
        faction: 'enemy',
        stats: { hp: 8, maxHp: 8, attack: 4, defense: 0, speed: 1, luck: 0 }
    });

    const forecast = forecastCombat(attacker, defender);

    // attacker: 10 + 5 (sword might) - 0 defense = 15 damage, way above defender's 8 hp.
    assert.equal(forecast.lethalToTarget, true);
    assert.ok(forecast.expectedDamageToTarget > 0);
    assert.equal(forecast.distance, 1);
});

test('forecastCombat reports no counter-risk when the defender is out of weapon range', () => {
    const attacker = makeUnit({ id: 'unit:a', x: 0, y: 0 });
    // Defender only has a 1-range sword but stands 2 tiles away.
    const defender = makeUnit({ id: 'unit:b', x: 2, y: 0, faction: 'enemy' });

    const forecast = forecastCombat(attacker, defender);

    assert.equal(forecast.targetCanCounter, false);
    assert.equal(forecast.expectedDamageToSelf, 0);
    assert.equal(forecast.selfDeathRisk, 0);
});

test('estimateDeathProbability returns 1 when hp is already at or below 0', () => {
    assert.equal(estimateDeathProbability(0, [{ hitChance: 50, critChance: 0, damage: 5, count: 1 }]), 1);
});

test('estimateDeathProbability returns 0 with no attacks', () => {
    assert.equal(estimateDeathProbability(10, []), 0);
});

test('estimateDeathProbability matches a hand-computed probability for a single guaranteed-lethal hit', () => {
    // 100% hit, 0% crit, damage covers hp exactly => certain death.
    const probability = estimateDeathProbability(5, [{ hitChance: 100, critChance: 0, damage: 5, count: 1 }]);
    assert.equal(probability, 1);
});

test('estimateDeathProbability accounts for a miss chance reducing death probability', () => {
    // 50% hit chance, guaranteed lethal damage on hit => 50% death probability.
    const probability = estimateDeathProbability(5, [{ hitChance: 50, critChance: 0, damage: 5, count: 1 }]);
    assert.equal(probability, 0.5);
});

test('estimateDeathProbability combines two attacks that are only lethal together', () => {
    // Each hit deals half the hp; both need to land for a kill: 0.5 * 0.5 = 0.25.
    const probability = estimateDeathProbability(10, [{ hitChance: 100, critChance: 0, damage: 5, count: 2 }]);
    // Both guaranteed hits land (hit=100%), so damage 5+5=10 >= 10 is certain.
    assert.equal(probability, 1);

    const uncertain = estimateDeathProbability(10, [{ hitChance: 50, critChance: 0, damage: 5, count: 2 }]);
    // Both must land: 0.5 * 0.5 = 0.25.
    assert.equal(uncertain, 0.25);
});
