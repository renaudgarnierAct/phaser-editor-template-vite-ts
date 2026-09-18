import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WeaponDefinition } from '../../data/items.ts';
import {
    canUseWeapon,
    compareRanks,
    gainWeaponExperience,
    getWeaponExperience,
    getWeaponRank,
    rankForExperience,
    WEAPON_RANK_THRESHOLDS
} from '../WeaponRankSystem.ts';

function makeWeapon(overrides: Partial<WeaponDefinition> = {}): WeaponDefinition {
    return {
        id: 'item:iron-sword',
        name: 'Épée de fer',
        kind: 'weapon',
        stackable: false,
        maxStack: 1,
        price: 400,
        sellable: true,
        weaponType: 'sword',
        rank: 'E',
        might: 5,
        hit: 90,
        crit: 0,
        range: [1, 1],
        weight: 5,
        ...overrides
    };
}

test('rankForExperience matches the default E/D/C/B/A/S thresholds', () => {
    assert.equal(rankForExperience(0), 'E');
    assert.equal(rankForExperience(29), 'E');
    assert.equal(rankForExperience(30), 'D');
    assert.equal(rankForExperience(69), 'D');
    assert.equal(rankForExperience(70), 'C');
    assert.equal(rankForExperience(119), 'C');
    assert.equal(rankForExperience(120), 'B');
    assert.equal(rankForExperience(179), 'B');
    assert.equal(rankForExperience(180), 'A');
    assert.equal(rankForExperience(254), 'A');
    assert.equal(rankForExperience(255), 'S');
    assert.equal(rankForExperience(9999), 'S');
});

test('compareRanks orders E < D < C < B < A < S', () => {
    assert.ok(compareRanks('E', 'D') < 0);
    assert.ok(compareRanks('S', 'A') > 0);
    assert.equal(compareRanks('C', 'C'), 0);
});

test('gainWeaponExperience accumulates without mutating the input progress', () => {
    const initial = { sword: 10 };

    const updated = gainWeaponExperience(initial, 'sword', 25);

    assert.equal(getWeaponExperience(initial, 'sword'), 10);
    assert.equal(getWeaponExperience(updated, 'sword'), 35);
});

test('gainWeaponExperience throws on a negative amount', () => {
    assert.throws(() => gainWeaponExperience({}, 'sword', -1));
});

test('getWeaponRank defaults to E for a weapon type never used', () => {
    assert.equal(getWeaponRank({}, 'lance'), 'E');
});

test('canUseWeapon requires the unit rank to meet or exceed the weapon rank', () => {
    const dRankWeapon = makeWeapon({ rank: 'D' });

    assert.equal(canUseWeapon({ sword: 0 }, dRankWeapon), false);
    assert.equal(canUseWeapon({ sword: WEAPON_RANK_THRESHOLDS.D }, dRankWeapon), true);
    assert.equal(canUseWeapon({ sword: WEAPON_RANK_THRESHOLDS.S }, dRankWeapon), true);
});
