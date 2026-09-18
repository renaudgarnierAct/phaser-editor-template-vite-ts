import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAction } from '../decide.ts';
import { getAIBehavior, listAIBehaviors, registerAIBehavior } from '../behaviors/index.ts';
import type { AIBehavior } from '../types.ts';
import { makeBoard, makeUnit } from './testUtils.ts';

test('aggressive behavior attacks a lethal, adjacent target', () => {
    const attacker = makeUnit({ id: 'unit:a', faction: 'enemy', x: 5, y: 5, movement: 4, stats: { hp: 20, maxHp: 20, attack: 12, defense: 2, speed: 6, luck: 0 } });
    const target = makeUnit({ id: 'unit:b', faction: 'player', x: 6, y: 5, stats: { hp: 5, maxHp: 20, attack: 1, defense: 0, speed: 1, luck: 0 } });
    const board = makeBoard([attacker, target]);

    const decision = decideAction(attacker, { behavior: 'aggressive' }, board);

    assert.equal(decision.action, 'attack');
    assert.equal(decision.target?.id, 'unit:b');
});

test('aggressive behavior moves towards the nearest enemy when none is in range', () => {
    const attacker = makeUnit({ id: 'unit:a', faction: 'enemy', x: 0, y: 0, movement: 3 });
    const target = makeUnit({ id: 'unit:b', faction: 'player', x: 10, y: 0 });
    const board = makeBoard([attacker, target]);

    const decision = decideAction(attacker, { behavior: 'aggressive' }, board);

    assert.equal(decision.action, 'move');
    assert.ok(decision.moveTo !== undefined && decision.moveTo.x > 0, 'should move closer to the target');
});

test('guard behavior ignores enemies outside aggroRange and stays near its post', () => {
    const guard = makeUnit({ id: 'unit:guard', faction: 'enemy', x: 5, y: 5, movement: 4 });
    const farTarget = makeUnit({ id: 'unit:far', faction: 'player', x: 5, y: 6 });
    const board = makeBoard([guard, farTarget]);

    const decision = decideAction(
        guard,
        { behavior: 'guard', guardPoint: { x: 5, y: 5 }, guardRadius: 1, aggroRange: 0 },
        board
    );

    // The enemy is adjacent (in weapon range) but outside the tiny aggroRange, so guard should not attack.
    assert.notEqual(decision.action, 'attack');
});

test('guard behavior engages once an enemy is within aggroRange', () => {
    const guard = makeUnit({ id: 'unit:guard', faction: 'enemy', x: 5, y: 5, movement: 4 });
    const nearTarget = makeUnit({ id: 'unit:near', faction: 'player', x: 6, y: 5, stats: { hp: 5, maxHp: 20, attack: 1, defense: 0, speed: 1, luck: 0 } });
    const board = makeBoard([guard, nearTarget]);

    const decision = decideAction(
        guard,
        { behavior: 'guard', guardPoint: { x: 5, y: 5 }, guardRadius: 3, aggroRange: 5 },
        board
    );

    assert.equal(decision.action, 'attack');
});

test('defensive behavior retreats instead of attacking when below its flee HP ratio', () => {
    const defender = makeUnit({ id: 'unit:def', faction: 'enemy', x: 5, y: 5, movement: 3, stats: { hp: 2, maxHp: 20, attack: 5, defense: 1, speed: 3, luck: 0 } });
    const enemy = makeUnit({ id: 'unit:enemy', faction: 'player', x: 5, y: 4, stats: { hp: 20, maxHp: 20, attack: 8, defense: 0, speed: 4, luck: 0 } });
    const board = makeBoard([defender, enemy]);

    const decision = decideAction(defender, { behavior: 'defensive', fleeHpRatio: 0.5 }, board);

    assert.equal(decision.action, 'move');
    assert.ok(decision.moveTo !== undefined);
    const distanceBefore = Math.abs(defender.x - enemy.x) + Math.abs(defender.y - enemy.y);
    const distanceAfter = decision.moveTo === undefined ? 0 : Math.abs(decision.moveTo.x - enemy.x) + Math.abs(decision.moveTo.y - enemy.y);
    assert.ok(distanceAfter > distanceBefore, 'should move farther away from the threat');
});

test('boss behavior secures a lethal blow even against a healthy target', () => {
    const boss = makeUnit({ id: 'unit:boss', faction: 'enemy', x: 5, y: 5, movement: 4, stats: { hp: 40, maxHp: 40, attack: 20, defense: 5, speed: 6, luck: 0 } });
    const target = makeUnit({ id: 'unit:target', faction: 'player', x: 6, y: 5, stats: { hp: 10, maxHp: 30, attack: 3, defense: 0, speed: 2, luck: 0 } });
    const board = makeBoard([boss, target]);

    const decision = decideAction(boss, { behavior: 'boss' }, board);

    assert.equal(decision.action, 'attack');
    assert.equal(decision.evaluation?.forecast.lethalToTarget, true);
});

test('decideAction waits when no move or attack is available', () => {
    const lone = makeUnit({ id: 'unit:lone', faction: 'enemy', x: 5, y: 5, movement: 3 });
    const board = makeBoard([lone]);

    const decision = decideAction(lone, { behavior: 'aggressive' }, board);

    assert.equal(decision.action, 'wait');
});

test('decideAction throws for an unregistered behavior id', () => {
    const unit = makeUnit();
    const board = makeBoard([unit]);
    assert.throws(() => decideAction(unit, { behavior: 'not-a-real-behavior' }, board));
});

test('the registry exposes all four built-in behaviors and supports custom registration', () => {
    const ids = listAIBehaviors();
    assert.ok(ids.includes('aggressive'));
    assert.ok(ids.includes('defensive'));
    assert.ok(ids.includes('guard'));
    assert.ok(ids.includes('boss'));

    const passive: AIBehavior = {
        id: 'passive-test',
        scoreTarget: () => 0,
        chooseIdleTile: () => undefined,
        shouldEngage: () => false
    };
    registerAIBehavior(passive);

    assert.equal(getAIBehavior('passive-test'), passive);
});
