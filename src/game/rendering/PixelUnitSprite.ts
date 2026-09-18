import * as Phaser from 'phaser';
import type { Faction, UnitData } from '../data/types';

const SKIN = 0xf3c79b;
const DARK = 0x2a2538;
const WHITE = 0xfff4d6;

export function createPixelUnitSprite(
    scene: Phaser.Scene,
    unit: UnitData
): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    const primary = unit.faction === 'player' ? 0x4db6ff : 0xe96565;
    const secondary = unit.faction === 'player' ? 0x193d73 : 0x702d45;
    const classId = unit.classId.replace('class:', '');

    graphics.fillStyle(DARK, 1);
    graphics.fillRect(-8, -15, 16, 5);
    graphics.fillRect(-12, -10, 24, 4);
    graphics.fillStyle(SKIN, 1);
    graphics.fillRect(-7, -6, 14, 10);
    graphics.fillStyle(DARK, 1);
    graphics.fillRect(-7, -6, 4, 3);
    graphics.fillRect(3, -6, 4, 3);

    if (classId === 'mage' || classId === 'sage') {
        graphics.fillStyle(secondary, 1);
        graphics.fillRect(-12, -14, 24, 4);
        graphics.fillRect(-9, -18, 18, 4);
        graphics.fillStyle(WHITE, 1);
        graphics.fillRect(9, -17, 3, 3);
    } else if (classId === 'knight' || classId === 'general') {
        graphics.fillStyle(secondary, 1);
        graphics.fillRect(-12, -8, 24, 18);
        graphics.fillRect(-15, -4, 5, 12);
        graphics.fillRect(10, -4, 5, 12);
    } else {
        graphics.fillStyle(primary, 1);
        graphics.fillRect(-11, -2, 22, 15);
        graphics.fillRect(-14, 2, 4, 9);
        graphics.fillRect(10, 2, 4, 9);
    }

    graphics.fillStyle(secondary, 1);
    graphics.fillRect(-9, 10, 7, 7);
    graphics.fillRect(2, 10, 7, 7);
    graphics.lineStyle(2, WHITE, 1);
    graphics.strokeRect(-16, -20, 32, 38);
    return graphics;
}
