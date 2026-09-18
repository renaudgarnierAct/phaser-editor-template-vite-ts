import { distanceTo, livingEnemiesOf, reachableTiles } from './range.ts';
import type { AIContext, GridPointLike } from './types.ts';
import type { GridPoint } from '../systems/GridSystem.ts';
import type { UnitData } from '../data/types.ts';

/** Picks the reachable tile with the smallest Manhattan distance to `point`. */
export function closestTileTo(candidates: readonly GridPoint[], point: GridPointLike): GridPoint | undefined {
    let best: GridPoint | undefined;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
        const distance = distanceTo(candidate, point);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}

/** Picks the reachable tile with the largest Manhattan distance to `point`. */
export function farthestTileFrom(candidates: readonly GridPoint[], point: GridPointLike): GridPoint | undefined {
    let best: GridPoint | undefined;
    let bestDistance = -Infinity;
    for (const candidate of candidates) {
        const distance = distanceTo(candidate, point);
        if (distance > bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}

/** The closest living enemy to `unit`, or `undefined` when none remain. */
export function nearestEnemy(unit: UnitData, context: AIContext): UnitData | undefined {
    const enemies = livingEnemiesOf(unit, context.board);
    let best: UnitData | undefined;
    let bestDistance = Infinity;
    for (const enemy of enemies) {
        const distance = distanceTo(unit, enemy);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = enemy;
        }
    }
    return best;
}

/** Tile the unit should move to when it cannot (or chooses not to) attack this turn. */
export function chooseIdleTileTowards(unit: UnitData, context: AIContext, point: GridPointLike): GridPoint | undefined {
    const tiles = reachableTiles(unit, context.board);
    return closestTileTo(tiles, point);
}

/** Tile the unit should move to in order to retreat away from `point` (e.g. the nearest threat). */
export function chooseIdleTileAwayFrom(unit: UnitData, context: AIContext, point: GridPointLike): GridPoint | undefined {
    const tiles = reachableTiles(unit, context.board);
    return farthestTileFrom(tiles, point);
}
