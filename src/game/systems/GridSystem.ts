import type { ChapterData, TerrainDefinition } from '../data/types';

export interface GridPoint {
    x: number;
    y: number;
}

export class GridSystem {
    private readonly chapter: ChapterData;

    constructor(chapter: ChapterData) {
        this.chapter = chapter;
    }

    terrainAt(point: GridPoint): TerrainDefinition | undefined {
        const code = this.chapter.map.tiles[point.y]?.[point.x];
        const terrainId = code === undefined ? undefined : this.chapter.map.terrainLegend[code];
        return terrainId === undefined ? undefined : this.chapter.terrain[terrainId];
    }

    reachableFrom(origin: GridPoint, movement: number, occupied: Set<string>): GridPoint[] {
        const distances = new Map<string, number>([[this.key(origin), 0]]);
        const queue: GridPoint[] = [origin];

        while (queue.length > 0) {
            const current = queue.shift();
            if (current === undefined) {
                continue;
            }

            const currentDistance = distances.get(this.key(current)) ?? 0;
            for (const next of this.neighbors(current)) {
                const terrain = this.terrainAt(next);
                if (terrain === undefined || occupied.has(this.key(next)) && this.key(next) !== this.key(origin)) {
                    continue;
                }

                const nextDistance = currentDistance + terrain.moveCost;
                const previousDistance = distances.get(this.key(next));
                if (nextDistance > movement || previousDistance !== undefined && previousDistance <= nextDistance) {
                    continue;
                }

                distances.set(this.key(next), nextDistance);
                queue.push(next);
            }
        }

        return [...distances.keys()].map((key) => this.fromKey(key));
    }

    key(point: GridPoint): string {
        return `${point.x},${point.y}`;
    }

    private fromKey(key: string): GridPoint {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    }

    private neighbors(point: GridPoint): GridPoint[] {
        return [
            { x: point.x + 1, y: point.y },
            { x: point.x - 1, y: point.y },
            { x: point.x, y: point.y + 1 },
            { x: point.x, y: point.y - 1 }
        ].filter(({ x, y }) => x >= 0 && y >= 0 && x < this.chapter.map.width && y < this.chapter.map.height);
    }
}
