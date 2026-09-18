import * as Phaser from 'phaser';
import { loadChapter } from '../data/loadChapter';
import type { ChapterData, UnitData } from '../data/types';
import { GridSystem, type GridPoint } from '../systems/GridSystem';

const TILE_SIZE = 56;
const BOARD_ORIGIN = { x: 32, y: 130 };

export default class Game extends Phaser.Scene {
    private chapter!: ChapterData;
    private grid!: GridSystem;
    private selectedUnit?: UnitData;
    private reachable = new Set<string>();
    private readonly unitSprites = new Map<string, Phaser.GameObjects.Container>();
    private statusText!: Phaser.GameObjects.Text;
    private boardLayer!: Phaser.GameObjects.Container;

    constructor() {
        super('Game');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x182331);
        this.add.text(32, 28, 'CHAPITRE 1  •  LA PRAIRIE D’AMBRE', {
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '24px',
            fontStyle: 'bold'
        });
        this.statusText = this.add.text(32, 72, 'Chargement de la carte...', {
            color: '#b9c7d6',
            fontFamily: 'Arial',
            fontSize: '16px'
        });
        this.loadChapter();
    }

    private async loadChapter(): Promise<void> {
        try {
            this.chapter = await loadChapter('/data/chapter-01.json');
            this.grid = new GridSystem(this.chapter);
            this.renderBoard();
            this.statusText.setText('Sélectionnez une unité bleue pour afficher ses déplacements.');
        } catch (error) {
            this.statusText.setColor('#ff9b9b');
            this.statusText.setText('Erreur de chargement des données de chapitre.');
            console.error(error);
        }
    }

    private renderBoard(): void {
        this.boardLayer = this.add.container(0, 0);
        for (let y = 0; y < this.chapter.map.height; y += 1) {
            for (let x = 0; x < this.chapter.map.width; x += 1) {
                const terrain = this.grid.terrainAt({ x, y });
                if (terrain === undefined) {
                    continue;
                }
                const tile = this.add.rectangle(
                    BOARD_ORIGIN.x + x * TILE_SIZE + TILE_SIZE / 2,
                    BOARD_ORIGIN.y + y * TILE_SIZE + TILE_SIZE / 2,
                    TILE_SIZE - 2,
                    TILE_SIZE - 2,
                    terrain.color
                ).setStrokeStyle(1, 0x263644, 0.8).setInteractive();
                tile.on('pointerdown', () => this.handleTileClick({ x, y }));
                this.boardLayer.add(tile);
            }
        }

        this.chapter.units.forEach((unit) => this.createUnitSprite(unit));
    }

    private createUnitSprite(unit: UnitData): void {
        const circle = this.add.circle(0, 0, 17, unit.color).setStrokeStyle(3, 0xf5f0df);
        const label = this.add.text(0, 25, unit.name, {
            color: '#ffffff',
            fontFamily: 'Arial',
            fontSize: '12px',
            stroke: '#182331',
            strokeThickness: 3
        }).setOrigin(0.5);
        const sprite = this.add.container(0, 0, [circle, label]).setSize(TILE_SIZE, TILE_SIZE).setInteractive();
        sprite.on('pointerdown', () => this.handleUnitClick(unit));
        this.unitSprites.set(unit.id, sprite);
        this.boardLayer.add(sprite);
        this.placeUnitSprite(unit);
    }

    private handleUnitClick(unit: UnitData): void {
        if (unit.faction !== 'player') {
            this.statusText.setText(`${unit.name} est une unité ennemie. Le combat arrivera dans la prochaine tranche.`);
            return;
        }

        this.selectedUnit = unit;
        const occupied = new Set(this.chapter.units.map((item) => this.grid.key({ x: item.x, y: item.y })));
        this.reachable = new Set(this.grid.reachableFrom(unit, unit.movement, occupied).map((point) => this.grid.key(point)));
        this.refreshHighlights();
        this.statusText.setText(`${unit.name} • ${unit.classId.replace('class:', '')} • déplacement ${unit.movement}. Cliquez une case surlignée.`);
    }

    private handleTileClick(point: GridPoint): void {
        if (this.selectedUnit === undefined || !this.reachable.has(this.grid.key(point))) {
            return;
        }

        const occupiedByOtherUnit = this.chapter.units.some((unit) =>
            unit.id !== this.selectedUnit?.id && unit.x === point.x && unit.y === point.y
        );
        if (occupiedByOtherUnit) {
            return;
        }

        this.selectedUnit.x = point.x;
        this.selectedUnit.y = point.y;
        this.placeUnitSprite(this.selectedUnit);
        this.reachable.clear();
        this.refreshHighlights();
        this.statusText.setText(`${this.selectedUnit.name} a rejoint la case ${point.x + 1},${point.y + 1}.`);
        this.selectedUnit = undefined;
    }

    private placeUnitSprite(unit: UnitData): void {
        this.unitSprites.get(unit.id)?.setPosition(
            BOARD_ORIGIN.x + unit.x * TILE_SIZE + TILE_SIZE / 2,
            BOARD_ORIGIN.y + unit.y * TILE_SIZE + TILE_SIZE / 2
        );
    }

    private refreshHighlights(): void {
        this.boardLayer?.each((child) => {
            const tile = child as Phaser.GameObjects.Rectangle;
            if (!(tile instanceof Phaser.GameObjects.Rectangle)) {
                return;
            }
            const point = {
                x: Math.round((tile.x - BOARD_ORIGIN.x - TILE_SIZE / 2) / TILE_SIZE),
                y: Math.round((tile.y - BOARD_ORIGIN.y - TILE_SIZE / 2) / TILE_SIZE)
            };
            const isReachable = this.reachable.has(this.grid.key(point));
            tile.setAlpha(isReachable ? 0.75 : 1);
            tile.setStrokeStyle(isReachable ? 3 : 1, isReachable ? 0xf8e7bd : 0x263644, 0.9);
        });
    }
}
