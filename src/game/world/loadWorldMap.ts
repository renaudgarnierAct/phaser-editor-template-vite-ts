import type { WorldMapData } from './types.ts';
import { InvalidWorldMapError } from './errors.ts';

/** Fetches and parses a world map JSON document from `path`, validating its structure. */
export async function loadWorldMap(path: string): Promise<WorldMapData> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load world map data: ${response.status}`);
    }

    const data = (await response.json()) as WorldMapData;
    validateWorldMap(data);
    return data;
}

/**
 * Validates the structural integrity of a world map: unique node ids, a valid start node and
 * connections that only reference existing nodes. Throws {@link InvalidWorldMapError} otherwise.
 */
export function validateWorldMap(map: WorldMapData): void {
    if (map.nodes.length === 0) {
        throw new InvalidWorldMapError('world map must declare at least one node');
    }

    const seenIds = new Set<string>();
    for (const node of map.nodes) {
        if (seenIds.has(node.id)) {
            throw new InvalidWorldMapError(`duplicate node id "${node.id}"`);
        }
        seenIds.add(node.id);
    }

    if (!seenIds.has(map.startNodeId)) {
        throw new InvalidWorldMapError(`startNodeId "${map.startNodeId}" does not match any node`);
    }

    for (const node of map.nodes) {
        for (const connectionId of node.connections) {
            if (!seenIds.has(connectionId)) {
                throw new InvalidWorldMapError(
                    `node "${node.id}" connects to unknown node "${connectionId}"`
                );
            }
        }
    }
}
