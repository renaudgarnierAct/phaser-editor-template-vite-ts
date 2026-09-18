import type { UnitData, WeaponData } from '../../data/types.ts';
import type { AIBoardQuery, GridPointLike } from '../types.ts';

const SWORD: WeaponData = { id: 'weapon:sword', name: 'Sword', might: 5, hit: 90, crit: 10, minRange: 1, maxRange: 1 };
const BOW: WeaponData = { id: 'weapon:bow', name: 'Bow', might: 6, hit: 80, crit: 5, minRange: 2, maxRange: 2 };

export function makeUnit(overrides: Partial<UnitData> = {}): UnitData {
    return {
        id: 'unit:test',
        name: 'Test',
        faction: 'player',
        classId: 'class:test',
        x: 0,
        y: 0,
        movement: 4,
        color: 0xffffff,
        stats: { hp: 20, maxHp: 20, attack: 8, defense: 3, speed: 6, luck: 5 },
        weapon: SWORD,
        ...overrides
    };
}

export function makeBowUnit(overrides: Partial<UnitData> = {}): UnitData {
    return makeUnit({ weapon: BOW, ...overrides });
}

/**
 * Simple in-memory `AIBoardQuery` over an open, wall-free grid: every tile is
 * passable with a move cost of 1 and no terrain bonus, and BFS movement
 * mirrors `GridSystem.reachableFrom`'s contract without depending on it, so
 * these tests exercise the AI module in isolation.
 */
export function makeBoard(units: UnitData[], size = { width: 20, height: 20 }): AIBoardQuery {
    const key = (point: GridPointLike): string => `${point.x},${point.y}`;

    return {
        units,
        terrainAt() {
            return { name: 'plain', moveCost: 1, defense: 0, avoid: 0, color: 0 };
        },
        tileKey: key,
        reachableFrom(origin, movement, occupied) {
            const distances = new Map<string, number>([[key(origin), 0]]);
            const queue: GridPointLike[] = [origin];

            while (queue.length > 0) {
                const current = queue.shift();
                if (current === undefined) {
                    continue;
                }
                const currentDistance = distances.get(key(current)) ?? 0;
                const neighbors: GridPointLike[] = [
                    { x: current.x + 1, y: current.y },
                    { x: current.x - 1, y: current.y },
                    { x: current.x, y: current.y + 1 },
                    { x: current.x, y: current.y - 1 }
                ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < size.width && point.y < size.height);

                for (const next of neighbors) {
                    const nextKey = key(next);
                    if (occupied.has(nextKey) && nextKey !== key(origin)) {
                        continue;
                    }
                    const nextDistance = currentDistance + 1;
                    const previous = distances.get(nextKey);
                    if (nextDistance > movement || (previous !== undefined && previous <= nextDistance)) {
                        continue;
                    }
                    distances.set(nextKey, nextDistance);
                    queue.push(next);
                }
            }

            return [...distances.keys()].map((entry) => {
                const [x, y] = entry.split(',').map(Number);
                return { x, y };
            });
        }
    };
}
