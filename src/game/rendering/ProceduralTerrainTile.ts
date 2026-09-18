import * as Phaser from 'phaser';
import type { TerrainTileKind } from './TerrainTileKind';

export { isTerrainTileKind, TERRAIN_TILE_KINDS, type TerrainTileKind } from './TerrainTileKind';

export type TerrainPalette = Record<string, number>;

type TilePrimitive =
    | { type: 'rect'; color: string; x: number; y: number; width: number; height: number }
    | { type: 'circle'; color: string; x: number; y: number; radius: number }
    | { type: 'triangle'; color: string; points: readonly [number, number, number, number, number, number] }
    | { type: 'line'; color: string; width: number; points: readonly number[] };

export interface TerrainTileDefinition {
    palette: TerrainPalette;
    primitives: readonly TilePrimitive[];
    detail: {
        colors: readonly string[];
        count: number;
        margin: number;
    };
}

export interface TerrainTileRenderOptions {
    /** Top-left position of the square tile. */
    x?: number;
    y?: number;
    size?: number;
    /** Stable variation key. Combining this with map coordinates keeps a board deterministic. */
    seed?: number;
    gridX?: number;
    gridY?: number;
    detailDensity?: number;
    palette?: Partial<TerrainPalette>;
    alpha?: number;
    borderColor?: number;
    borderAlpha?: number;
}

const DESIGN_SIZE = 32;

const TERRAIN_TILE_DEFINITIONS: Record<TerrainTileKind, TerrainTileDefinition> = {
    plain: {
        palette: {
            ground: 0x9dce69,
            light: 0xc1e58a,
            grass: 0x4f9b58,
            dark: 0x367849
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'line', color: 'grass', width: 1, points: [5, 25, 5, 21, 3, 19, 5, 21, 7, 18] },
            { type: 'line', color: 'dark', width: 1, points: [24, 12, 24, 8, 22, 6, 24, 8, 27, 6] },
            { type: 'rect', color: 'light', x: 11, y: 5, width: 4, height: 2 }
        ],
        detail: { colors: ['light', 'grass'], count: 7, margin: 2 }
    },
    forest: {
        palette: {
            ground: 0x5f9e55,
            trunk: 0x68462f,
            shadow: 0x24553b,
            leaves: 0x2f7543,
            light: 0x62a84f
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'rect', color: 'trunk', x: 7, y: 15, width: 3, height: 12 },
            { type: 'circle', color: 'shadow', x: 8, y: 12, radius: 7 },
            { type: 'circle', color: 'leaves', x: 6, y: 9, radius: 5 },
            { type: 'circle', color: 'light', x: 8, y: 7, radius: 3 },
            { type: 'rect', color: 'trunk', x: 21, y: 13, width: 4, height: 14 },
            { type: 'circle', color: 'shadow', x: 23, y: 11, radius: 8 },
            { type: 'circle', color: 'leaves', x: 20, y: 8, radius: 5 },
            { type: 'circle', color: 'light', x: 23, y: 6, radius: 3 }
        ],
        detail: { colors: ['shadow', 'light'], count: 4, margin: 2 }
    },
    fort: {
        palette: {
            ground: 0x8e967d,
            stone: 0xb9b9a7,
            light: 0xd9d5bd,
            mortar: 0x6c7068,
            gate: 0x4d4038
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'rect', color: 'mortar', x: 3, y: 7, width: 26, height: 23 },
            { type: 'rect', color: 'stone', x: 4, y: 8, width: 24, height: 21 },
            { type: 'rect', color: 'stone', x: 3, y: 4, width: 6, height: 8 },
            { type: 'rect', color: 'stone', x: 13, y: 4, width: 6, height: 8 },
            { type: 'rect', color: 'stone', x: 23, y: 4, width: 6, height: 8 },
            { type: 'rect', color: 'gate', x: 12, y: 18, width: 8, height: 11 },
            { type: 'circle', color: 'gate', x: 16, y: 18, radius: 4 },
            { type: 'line', color: 'mortar', width: 1, points: [4, 14, 28, 14, 4, 20, 28, 20, 9, 8, 9, 29, 23, 8, 23, 29] },
            { type: 'rect', color: 'light', x: 5, y: 9, width: 3, height: 2 }
        ],
        detail: { colors: ['light', 'mortar'], count: 3, margin: 4 }
    },
    mountain: {
        palette: {
            ground: 0xa2a071,
            shadow: 0x575e58,
            rock: 0x7b8176,
            light: 0xc8c7ad,
            snow: 0xeee8d4
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'triangle', color: 'shadow', points: [1, 29, 17, 3, 31, 29] },
            { type: 'triangle', color: 'rock', points: [5, 29, 17, 5, 25, 29] },
            { type: 'triangle', color: 'light', points: [17, 5, 17, 21, 10, 17] },
            { type: 'triangle', color: 'snow', points: [17, 5, 11, 15, 15, 13] },
            { type: 'triangle', color: 'snow', points: [17, 5, 15, 13, 19, 11] },
            { type: 'line', color: 'shadow', width: 1, points: [4, 29, 28, 29] }
        ],
        detail: { colors: ['rock', 'light'], count: 4, margin: 2 }
    },
    road: {
        palette: {
            ground: 0x83b65c,
            edge: 0x75634b,
            road: 0xc8ad78,
            light: 0xe0c994,
            stone: 0x9b835d
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'rect', color: 'edge', x: 8, y: 0, width: 16, height: 32 },
            { type: 'rect', color: 'road', x: 9, y: 0, width: 14, height: 32 },
            { type: 'line', color: 'light', width: 1, points: [11, 0, 11, 32, 21, 0, 21, 32] },
            { type: 'rect', color: 'stone', x: 14, y: 5, width: 3, height: 2 },
            { type: 'rect', color: 'stone', x: 18, y: 17, width: 2, height: 3 },
            { type: 'rect', color: 'stone', x: 12, y: 26, width: 3, height: 2 }
        ],
        detail: { colors: ['light', 'stone'], count: 4, margin: 9 }
    },
    house: {
        palette: {
            ground: 0x8fbd62,
            wall: 0xe3c58d,
            wallShadow: 0xb38a5b,
            roof: 0xb95042,
            roofLight: 0xe07655,
            door: 0x594436
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'rect', color: 'wallShadow', x: 6, y: 15, width: 20, height: 15 },
            { type: 'rect', color: 'wall', x: 7, y: 15, width: 18, height: 14 },
            { type: 'triangle', color: 'roof', points: [3, 16, 16, 4, 29, 16] },
            { type: 'triangle', color: 'roofLight', points: [7, 14, 16, 6, 16, 10] },
            { type: 'rect', color: 'door', x: 14, y: 21, width: 6, height: 8 },
            { type: 'rect', color: 'roofLight', x: 8, y: 20, width: 4, height: 4 }
        ],
        detail: { colors: ['wall', 'roofLight'], count: 3, margin: 2 }
    },
    village: {
        palette: {
            ground: 0x91bd66,
            path: 0xc7aa72,
            wall: 0xe0c38d,
            roof: 0xa9463f,
            roofLight: 0xd96b50,
            door: 0x544238
        },
        primitives: [
            { type: 'rect', color: 'ground', x: 0, y: 0, width: 32, height: 32 },
            { type: 'line', color: 'path', width: 5, points: [16, 32, 16, 21, 7, 16, 25, 9] },
            { type: 'rect', color: 'wall', x: 3, y: 10, width: 12, height: 10 },
            { type: 'triangle', color: 'roof', points: [1, 11, 9, 3, 17, 11] },
            { type: 'triangle', color: 'roofLight', points: [4, 10, 9, 5, 9, 8] },
            { type: 'rect', color: 'door', x: 8, y: 15, width: 4, height: 5 },
            { type: 'rect', color: 'wall', x: 18, y: 16, width: 11, height: 11 },
            { type: 'triangle', color: 'roof', points: [16, 17, 23, 9, 31, 17] },
            { type: 'triangle', color: 'roofLight', points: [19, 16, 23, 11, 23, 14] },
            { type: 'rect', color: 'door', x: 21, y: 22, width: 4, height: 5 }
        ],
        detail: { colors: ['path', 'roofLight'], count: 3, margin: 2 }
    }
};

export function getTerrainTileDefinition(kind: TerrainTileKind): TerrainTileDefinition {
    return TERRAIN_TILE_DEFINITIONS[kind];
}

/**
 * Creates a reusable square terrain graphic without textures or external assets.
 *
 * Add the returned Graphics object to a scene or board layer. Keep interaction
 * on a separate hit area when highlights must be redrawn independently.
 */
export function createProceduralTerrainTile(
    scene: Phaser.Scene,
    kind: TerrainTileKind,
    options: TerrainTileRenderOptions = {}
): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    return drawProceduralTerrainTile(graphics, kind, options);
}

/** Clears and redraws an existing Graphics object, allowing pooling and live theme changes. */
export function drawProceduralTerrainTile(
    graphics: Phaser.GameObjects.Graphics,
    kind: TerrainTileKind,
    options: TerrainTileRenderOptions = {}
): Phaser.GameObjects.Graphics {
    const definition = getTerrainTileDefinition(kind);
    const size = options.size ?? DESIGN_SIZE;
    const scale = size / DESIGN_SIZE;
    const palette: TerrainPalette = { ...definition.palette };
    for (const [key, color] of Object.entries(options.palette ?? {})) {
        if (color !== undefined) {
            palette[key] = color;
        }
    }
    const alpha = options.alpha ?? 1;

    graphics.clear();
    graphics.setPosition(options.x ?? 0, options.y ?? 0);

    for (const primitive of definition.primitives) {
        drawPrimitive(graphics, primitive, palette, scale, alpha);
    }

    drawDetails(graphics, definition, palette, scale, options, alpha);
    graphics.lineStyle(Math.max(1, scale), options.borderColor ?? 0x263644, options.borderAlpha ?? 0.65);
    graphics.strokeRect(0, 0, size, size);
    return graphics;
}

function drawPrimitive(
    graphics: Phaser.GameObjects.Graphics,
    primitive: TilePrimitive,
    palette: TerrainPalette,
    scale: number,
    alpha: number
): void {
    const color = palette[primitive.color];
    if (color === undefined) {
        throw new Error(`Missing procedural terrain palette color "${primitive.color}".`);
    }

    if (primitive.type === 'rect') {
        graphics.fillStyle(color, alpha);
        graphics.fillRect(primitive.x * scale, primitive.y * scale, primitive.width * scale, primitive.height * scale);
        return;
    }
    if (primitive.type === 'circle') {
        graphics.fillStyle(color, alpha);
        graphics.fillCircle(primitive.x * scale, primitive.y * scale, primitive.radius * scale);
        return;
    }
    if (primitive.type === 'triangle') {
        const [x1, y1, x2, y2, x3, y3] = primitive.points;
        graphics.fillStyle(color, alpha);
        graphics.fillTriangle(x1 * scale, y1 * scale, x2 * scale, y2 * scale, x3 * scale, y3 * scale);
        return;
    }

    graphics.lineStyle(Math.max(1, primitive.width * scale), color, alpha);
    graphics.beginPath();
    for (let index = 0; index < primitive.points.length; index += 2) {
        const x = (primitive.points[index] ?? 0) * scale;
        const y = (primitive.points[index + 1] ?? 0) * scale;
        if (index === 0) {
            graphics.moveTo(x, y);
        } else {
            graphics.lineTo(x, y);
        }
    }
    graphics.strokePath();
}

function drawDetails(
    graphics: Phaser.GameObjects.Graphics,
    definition: TerrainTileDefinition,
    palette: TerrainPalette,
    scale: number,
    options: TerrainTileRenderOptions,
    alpha: number
): void {
    const count = Math.max(0, Math.round(definition.detail.count * (options.detailDensity ?? 1)));
    const random = mulberry32(
        (options.seed ?? 0x7a11e) ^
        Math.imul(options.gridX ?? 0, 0x45d9f3b) ^
        Math.imul(options.gridY ?? 0, 0x119de1f3)
    );
    const span = DESIGN_SIZE - definition.detail.margin * 2 - 1;

    for (let index = 0; index < count; index += 1) {
        const colorKey = definition.detail.colors[Math.floor(random() * definition.detail.colors.length)];
        const color = colorKey === undefined ? undefined : palette[colorKey];
        if (color === undefined) {
            throw new Error(`Missing procedural terrain detail color "${colorKey ?? ''}".`);
        }
        const x = (definition.detail.margin + Math.floor(random() * span)) * scale;
        const y = (definition.detail.margin + Math.floor(random() * span)) * scale;
        const pixelSize = Math.max(1, scale);
        graphics.fillStyle(color, alpha * 0.7);
        graphics.fillRect(x, y, pixelSize, pixelSize);
    }
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}
