import * as Phaser from 'phaser';
import type { Faction, UnitData } from '../data/types';

const SKIN = 0xf2bd8c;
const HAIR = 0x34283b;
const INK = 0x171c2b;
const LIGHT = 0xfff3c4;
const STEEL = 0xb8cad4;

export type PixelUnitFacing = 'left' | 'right';

export interface PixelUnitIdleOptions {
    distance?: number;
    duration?: number;
    delay?: number;
}

interface FactionPalette {
    primary: number;
    secondary: number;
    accent: number;
}

const FACTION_PALETTES: Record<Faction, FactionPalette> = {
    player: {
        primary: 0x3b82d0,
        secondary: 0x173b70,
        accent: 0xffd447
    },
    enemy: {
        primary: 0xc44768,
        secondary: 0x67234b,
        accent: 0xff9f43
    }
};

type UnitArchetype = 'lord' | 'cavalier' | 'knight' | 'archer' | 'mage' | 'soldier';

const CLASS_ARCHETYPES: Record<string, UnitArchetype> = {
    lord: 'lord',
    great_lord: 'lord',
    high_lord: 'lord',
    hero: 'lord',
    cavalier: 'cavalier',
    paladin: 'cavalier',
    great_knight: 'cavalier',
    bow_knight: 'cavalier',
    knight: 'knight',
    armor_knight: 'knight',
    general: 'knight',
    archer: 'archer',
    sniper: 'archer',
    marksman: 'archer',
    mage: 'mage',
    sage: 'mage',
    archmage: 'mage'
};

function fill(graphics: Phaser.GameObjects.Graphics, color: number, x: number, y: number, width: number, height: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x, y, width, height);
}

function className(classId: string): string {
    return classId.replace(/^class:/, '').toLowerCase().replace(/[-\s]/g, '_');
}

function isPromotedClass(id: string): boolean {
    return [
        'great_lord',
        'high_lord',
        'hero',
        'paladin',
        'great_knight',
        'bow_knight',
        'general',
        'sniper',
        'marksman',
        'sage',
        'archmage'
    ].includes(id);
}

function drawHead(graphics: Phaser.GameObjects.Graphics): void {
    fill(graphics, HAIR, -5, -13, 10, 3);
    fill(graphics, SKIN, -5, -10, 10, 7);
    fill(graphics, HAIR, -6, -10, 3, 4);
    fill(graphics, INK, 2, -8, 2, 2);
}

function drawLord(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, palette.secondary, -9, -3, 8, 16);
    fill(graphics, palette.primary, -5, -3, 13, 13);
    fill(graphics, LIGHT, 0, -1, 3, 9);
    fill(graphics, palette.accent, -7, -15, 3, 3);
    fill(graphics, palette.accent, -1, -16, 3, 4);
    fill(graphics, STEEL, 9, -5, 2, 15);
    fill(graphics, LIGHT, 7, 7, 6, 2);
    if (promoted) {
        fill(graphics, palette.accent, -11, 0, 4, 10);
        fill(graphics, LIGHT, 5, 0, 3, 3);
    }
}

function drawCavalier(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, palette.primary, -7, -3, 13, 10);
    fill(graphics, palette.secondary, -12, 5, 20, 8);
    fill(graphics, palette.secondary, 6, 1, 7, 8);
    fill(graphics, INK, 9, 7, 5, 3);
    fill(graphics, palette.accent, -2, -4, 4, 8);
    fill(graphics, INK, -10, 13, 4, 3);
    fill(graphics, INK, 3, 13, 4, 3);
    fill(graphics, STEEL, 11, -15, 2, 17);
    fill(graphics, LIGHT, 9, -14, 6, 2);
    if (promoted) {
        fill(graphics, STEEL, -8, -2, 5, 6);
        fill(graphics, palette.accent, -11, 6, 4, 3);
    }
}

function drawKnight(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, STEEL, -8, -13, 16, 4);
    fill(graphics, INK, -6, -9, 12, 3);
    fill(graphics, palette.secondary, -11, -5, 20, 17);
    fill(graphics, STEEL, -14, -3, 6, 12);
    fill(graphics, palette.primary, 7, -1, 7, 12);
    fill(graphics, LIGHT, 9, 1, 2, 7);
    fill(graphics, palette.accent, -2, -5, 4, 12);
    if (promoted) {
        fill(graphics, palette.accent, -3, -16, 6, 3);
        fill(graphics, STEEL, -13, 9, 5, 4);
    }
}

function drawArcher(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, palette.primary, -7, -3, 14, 14);
    fill(graphics, palette.secondary, -10, -1, 5, 11);
    fill(graphics, palette.accent, -5, -2, 3, 12);
    fill(graphics, LIGHT, 8, -9, 2, 19);
    fill(graphics, LIGHT, 10, -11, 3, 3);
    fill(graphics, LIGHT, 10, 8, 3, 3);
    fill(graphics, LIGHT, 12, -8, 2, 16);
    fill(graphics, STEEL, 5, -1, 10, 2);
    if (promoted) {
        fill(graphics, palette.accent, -8, -15, 13, 3);
        fill(graphics, LIGHT, -11, -12, 4, 2);
    }
}

function drawMage(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, palette.secondary, -11, -12, 19, 4);
    fill(graphics, palette.secondary, -7, -16, 11, 4);
    fill(graphics, palette.primary, -8, -3, 16, 15);
    fill(graphics, palette.secondary, -11, 8, 22, 5);
    fill(graphics, LIGHT, 10, -12, 2, 23);
    fill(graphics, palette.accent, 8, -15, 6, 6);
    fill(graphics, LIGHT, 10, -13, 2, 2);
    if (promoted) {
        fill(graphics, palette.accent, -4, -15, 4, 3);
        fill(graphics, LIGHT, -2, 0, 4, 4);
    }
}

function drawSoldier(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette, promoted: boolean): void {
    fill(graphics, palette.primary, -8, -3, 16, 14);
    fill(graphics, palette.secondary, -11, 0, 5, 10);
    fill(graphics, palette.accent, -2, -3, 4, 7);
    fill(graphics, STEEL, 10, -14, 2, 25);
    fill(graphics, LIGHT, 8, -13, 6, 3);
    if (promoted) {
        fill(graphics, STEEL, 5, 0, 5, 7);
    }
}

function drawFeet(graphics: Phaser.GameObjects.Graphics, palette: FactionPalette): void {
    fill(graphics, palette.secondary, -7, 10, 5, 5);
    fill(graphics, palette.secondary, 3, 10, 5, 5);
    fill(graphics, INK, -9, 14, 7, 2);
    fill(graphics, INK, 3, 14, 7, 2);
}

export function setPixelUnitFacing(
    sprite: Phaser.GameObjects.Graphics,
    facing: PixelUnitFacing
): Phaser.GameObjects.Graphics {
    sprite.setScale(facing === 'left' ? -1 : 1, 1);
    return sprite;
}

export function addPixelUnitIdleAnimation(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Graphics,
    options: PixelUnitIdleOptions = {}
): Phaser.Tweens.Tween {
    return scene.tweens.add({
        targets: sprite,
        y: -Math.abs(options.distance ?? 1),
        duration: options.duration ?? 700,
        delay: options.delay ?? 0,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1
    });
}

export function createPixelUnitSprite(
    scene: Phaser.Scene,
    unit: UnitData
): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    const palette = FACTION_PALETTES[unit.faction];
    const id = className(unit.classId);
    const archetype = CLASS_ARCHETYPES[id] ?? 'soldier';
    const promoted = isPromotedClass(id);

    if (archetype !== 'knight') {
        drawHead(graphics);
    }

    switch (archetype) {
        case 'lord':
            drawLord(graphics, palette, promoted);
            break;
        case 'cavalier':
            drawCavalier(graphics, palette, promoted);
            break;
        case 'knight':
            drawKnight(graphics, palette, promoted);
            break;
        case 'archer':
            drawArcher(graphics, palette, promoted);
            break;
        case 'mage':
            drawMage(graphics, palette, promoted);
            break;
        default:
            drawSoldier(graphics, palette, promoted);
    }

    if (archetype !== 'cavalier') {
        drawFeet(graphics, palette);
    }

    graphics.lineStyle(1, INK, 0.9);
    graphics.strokeRect(-15, -16, 30, 32);
    setPixelUnitFacing(graphics, unit.faction === 'player' ? 'right' : 'left');
    addPixelUnitIdleAnimation(scene, graphics, {
        delay: Math.abs(hashUnitId(unit.id)) % 350
    });
    return graphics;
}

function hashUnitId(id: string): number {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = (hash * 31 + id.charCodeAt(index)) | 0;
    }
    return hash;
}
