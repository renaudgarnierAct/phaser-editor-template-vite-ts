import type { GridSystem, GridPoint } from '../systems/GridSystem.ts';
import type { ChapterData } from '../data/types.ts';
import type { AIBoardQuery } from './types.ts';

/**
 * Thin, read-only adapter exposing a `ChapterData` + `GridSystem` pair as an
 * `AIBoardQuery`. This is the only file that touches `GridSystem` directly;
 * every other AI module only depends on the `AIBoardQuery` interface, so the
 * AI slice can be wired into the game (or unit tested with a fake board)
 * without ever changing `GridSystem`/`CombatSystem` themselves.
 */
export function createBoardQuery(chapter: ChapterData, grid: GridSystem): AIBoardQuery {
    return {
        get units() {
            return chapter.units;
        },
        terrainAt(point: GridPoint) {
            return grid.terrainAt(point);
        },
        reachableFrom(origin: GridPoint, movement: number, occupied: ReadonlySet<string>) {
            return grid.reachableFrom(origin, movement, occupied as Set<string>);
        },
        tileKey(point: GridPoint) {
            return grid.key(point);
        }
    };
}
