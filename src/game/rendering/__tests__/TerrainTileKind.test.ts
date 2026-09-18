import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isTerrainTileKind, TERRAIN_TILE_KINDS } from '../TerrainTileKind.ts';

test('the procedural renderer supports every terrain used by the tactical board', () => {
    assert.deepEqual(TERRAIN_TILE_KINDS, [
        'plain',
        'forest',
        'fort',
        'mountain',
        'road',
        'house',
        'village'
    ]);

    for (const kind of TERRAIN_TILE_KINDS) {
        assert.equal(isTerrainTileKind(kind), true);
    }
    assert.equal(isTerrainTileKind('swamp'), false);
});

test('the playable chapter visibly uses every procedural terrain kind', async () => {
    const chapterUrl = new URL('../../../../public/data/chapter-01.json', import.meta.url);
    const chapter = JSON.parse(await readFile(chapterUrl, 'utf8')) as {
        map: {
            tiles: string[];
            terrainLegend: Record<string, string>;
        };
    };
    const visibleKinds = new Set(
        chapter.map.tiles.flatMap((row) =>
            [...row].map((code) => chapter.map.terrainLegend[code])
        )
    );

    assert.deepEqual([...visibleKinds].sort(), [...TERRAIN_TILE_KINDS].sort());
});
