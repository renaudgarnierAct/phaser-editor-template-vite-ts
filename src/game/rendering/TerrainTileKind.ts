export const TERRAIN_TILE_KINDS = [
    'plain',
    'forest',
    'fort',
    'mountain',
    'road',
    'house',
    'village'
] as const;

export type TerrainTileKind = typeof TERRAIN_TILE_KINDS[number];

const TERRAIN_TILE_KIND_SET: ReadonlySet<string> = new Set(TERRAIN_TILE_KINDS);

export function isTerrainTileKind(value: string): value is TerrainTileKind {
    return TERRAIN_TILE_KIND_SET.has(value);
}
