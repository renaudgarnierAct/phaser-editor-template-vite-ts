import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChapterData } from '../../data/types.ts';
import { GridSystem } from '../../systems/GridSystem.ts';
import { createBoardQuery } from '../board.ts';
import { decideAction } from '../decide.ts';
import { makeUnit } from './testUtils.ts';

function makeChapter(): ChapterData {
    const enemy = makeUnit({ id: 'unit:enemy', faction: 'enemy', x: 2, y: 0, stats: { hp: 5, maxHp: 20, attack: 1, defense: 0, speed: 1, luck: 0 } });
    const player = makeUnit({ id: 'unit:player', faction: 'player', x: 0, y: 0, movement: 4 });

    return {
        id: 'chapter:test',
        name: 'Test chapter',
        map: {
            width: 5,
            height: 1,
            tiles: ['PPPPP'],
            terrainLegend: { P: 'plain' }
        },
        terrain: {
            plain: { name: 'Plaine', moveCost: 1, defense: 0, avoid: 0, color: 0 }
        },
        units: [player, enemy]
    };
}

test('createBoardQuery adapts a real GridSystem/ChapterData pair for the AI to consume', () => {
    const chapter = makeChapter();
    const grid = new GridSystem(chapter);
    const board = createBoardQuery(chapter, grid);

    assert.equal(board.units.length, 2);
    assert.equal(grid.terrainIdAt({ x: 0, y: 0 }), 'plain');
    assert.equal(grid.terrainIdAt({ x: -1, y: 0 }), undefined);
    assert.deepEqual(board.terrainAt({ x: 0, y: 0 }), { name: 'Plaine', moveCost: 1, defense: 0, avoid: 0, color: 0 });
    assert.equal(board.tileKey({ x: 1, y: 2 }), '1,2');

    const [player] = chapter.units;
    const decision = decideAction(player, { behavior: 'aggressive' }, board);

    // The enemy at x=2 with 5 hp is a lethal, reachable target for the player unit.
    assert.equal(decision.action, 'attack');
    assert.equal(decision.target?.id, 'unit:enemy');
});
