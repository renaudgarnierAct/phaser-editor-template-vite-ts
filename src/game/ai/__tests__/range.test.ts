import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAttackOptions, livingEnemiesOf, occupiedTileKeys, reachableTiles } from '../range.ts';
import { makeBoard, makeBowUnit, makeUnit } from './testUtils.ts';

test('reachableTiles returns tiles within movement, excluding blocked ones', () => {
    const mover = makeUnit({ id: 'unit:mover', x: 0, y: 0, movement: 2 });
    const blocker = makeUnit({ id: 'unit:blocker', x: 1, y: 0, faction: 'enemy' });
    const board = makeBoard([mover, blocker]);

    const tiles = reachableTiles(mover, board);
    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));

    assert.ok(keys.has('0,0'));
    assert.ok(!keys.has('1,0'), 'occupied tile should not be reachable as a destination');
    assert.ok(keys.has('0,2'));
    assert.ok(!keys.has('0,3'), 'tile beyond movement should be unreachable');
});

test('occupiedTileKeys ignores dead units and the excluded unit itself', () => {
    const self = makeUnit({ id: 'unit:self', x: 0, y: 0 });
    const dead = makeUnit({ id: 'unit:dead', x: 1, y: 0, stats: { hp: 0, maxHp: 10, attack: 1, defense: 1, speed: 1, luck: 0 } });
    const alive = makeUnit({ id: 'unit:alive', x: 2, y: 0, faction: 'enemy' });
    const board = makeBoard([self, dead, alive]);

    const occupied = occupiedTileKeys(board, self);

    assert.ok(!occupied.has('0,0'));
    assert.ok(!occupied.has('1,0'));
    assert.ok(occupied.has('2,0'));
});

test('livingEnemiesOf only returns living units of a different faction', () => {
    const self = makeUnit({ id: 'unit:self', faction: 'player' });
    const deadEnemy = makeUnit({ id: 'unit:dead-enemy', faction: 'enemy', stats: { hp: 0, maxHp: 10, attack: 1, defense: 1, speed: 1, luck: 0 } });
    const enemy = makeUnit({ id: 'unit:enemy', faction: 'enemy' });
    const ally = makeUnit({ id: 'unit:ally', faction: 'player' });
    const board = makeBoard([self, deadEnemy, enemy, ally]);

    const enemies = livingEnemiesOf(self, board);

    assert.deepEqual(enemies.map((u) => u.id), ['unit:enemy']);
});

test('findAttackOptions finds melee tiles adjacent to an enemy', () => {
    const unit = makeUnit({ id: 'unit:melee', x: 0, y: 0, movement: 3 });
    const enemy = makeUnit({ id: 'unit:enemy', x: 3, y: 0, faction: 'enemy' });
    const board = makeBoard([unit, enemy]);

    const options = findAttackOptions(unit, board);

    assert.ok(options.some((option) => option.tile.x === 2 && option.tile.y === 0 && option.target.id === 'unit:enemy'));
    assert.ok(options.every((option) => option.distance === 1));
});

test('findAttackOptions honors minRange for ranged weapons (no adjacent option)', () => {
    const archer = makeBowUnit({ id: 'unit:archer', x: 0, y: 0, movement: 3 });
    const enemy = makeUnit({ id: 'unit:enemy', x: 2, y: 0, faction: 'enemy' });
    const board = makeBoard([archer, enemy]);

    const options = findAttackOptions(archer, board);

    assert.ok(options.length > 0);
    assert.ok(options.every((option) => option.distance === 2), 'bow has minRange=2 so adjacent tiles are excluded');
});
