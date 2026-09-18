import { isInWeaponRange, manhattanDistance } from '../systems/CombatSystem.ts';
import type { GridPoint } from '../systems/GridSystem.ts';
import type { UnitData } from '../data/types.ts';
import type { AIBoardQuery } from './types.ts';

/** A reachable tile paired with the living enemy it would let the unit strike. */
export interface AttackOption {
    tile: GridPoint;
    target: UnitData;
    distance: number;
}

/** Tile keys currently occupied by living units, excluding `exclude` itself. */
export function occupiedTileKeys(board: AIBoardQuery, exclude?: UnitData): ReadonlySet<string> {
    const occupied = new Set<string>();
    for (const unit of board.units) {
        if (unit.stats.hp <= 0 || (exclude !== undefined && unit.id === exclude.id)) {
            continue;
        }
        occupied.add(board.tileKey({ x: unit.x, y: unit.y }));
    }
    return occupied;
}

/** All tiles `unit` could move to this turn, including its current tile. */
export function reachableTiles(unit: UnitData, board: AIBoardQuery): GridPoint[] {
    const occupied = occupiedTileKeys(board, unit);
    return board.reachableFrom({ x: unit.x, y: unit.y }, unit.movement, occupied);
}

/** Living units belonging to a different faction than `unit`. */
export function livingEnemiesOf(unit: UnitData, board: AIBoardQuery): UnitData[] {
    return board.units.filter((other) => other.faction !== unit.faction && other.stats.hp > 0);
}

/**
 * Every (reachable tile, enemy) pairing that puts `unit`'s weapon in range,
 * ignoring tiles occupied by other living units (other than the enemy itself,
 * which never blocks its own tile since attacks don't require moving onto it).
 */
export function findAttackOptions(unit: UnitData, board: AIBoardQuery): AttackOption[] {
    const tiles = reachableTiles(unit, board);
    const enemies = livingEnemiesOf(unit, board);
    const options: AttackOption[] = [];

    for (const tile of tiles) {
        for (const target of enemies) {
            const distance = manhattanDistance(tile, target);
            if (isInWeaponRange(unit.weapon, distance)) {
                options.push({ tile, target, distance });
            }
        }
    }

    return options;
}

/**
 * Set of tile keys `unit` currently threatens (i.e. could attack into) from
 * its present position, without moving. Useful to evaluate whether a
 * candidate destination tile is itself exposed to a given enemy's range.
 */
export function threatenedTileKeys(unit: UnitData, board: AIBoardQuery, maxWidth: number, maxHeight: number): Set<string> {
    const threatened = new Set<string>();
    const occupied = occupiedTileKeys(board, unit);
    const reachable = board.reachableFrom({ x: unit.x, y: unit.y }, unit.movement, occupied);
    for (const origin of reachable) {
        for (let y = 0; y < maxHeight; y += 1) {
            for (let x = 0; x < maxWidth; x += 1) {
                const distance = manhattanDistance(origin, { x, y });
                if (isInWeaponRange(unit.weapon, distance)) {
                    threatened.add(board.tileKey({ x, y }));
                }
            }
        }
    }
    return threatened;
}

/** Manhattan distance from `unit` to `point`, re-exported for convenience. */
export function distanceTo(unit: GridPoint, point: GridPoint): number {
    return manhattanDistance(unit, point);
}
