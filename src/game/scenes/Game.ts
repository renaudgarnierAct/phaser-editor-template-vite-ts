import * as Phaser from 'phaser';
import { loadChapter } from '../data/loadChapter';
import type { ChapterData, UnitData } from '../data/types';
import { GridSystem, type GridPoint } from '../systems/GridSystem';
import {
    isInWeaponRange,
    manhattanDistance,
    previewCombat,
    resolveCombat,
    type CombatPreview,
    type CombatResult,
    type TerrainCombatBonus
} from '../systems/CombatSystem';

const TILE_SIZE = 56;
const BOARD_ORIGIN = { x: 32, y: 130 };

export default class Game extends Phaser.Scene {
    private chapter!: ChapterData;
    private grid!: GridSystem;
    private selectedUnit?: UnitData;
    private reachable = new Set<string>();
    private attackable = new Map<string, UnitData>();
    private readonly unitSprites = new Map<string, Phaser.GameObjects.Container>();
    private readonly unitCircles = new Map<string, Phaser.GameObjects.Arc>();
    private readonly unitHpTexts = new Map<string, Phaser.GameObjects.Text>();
    private statusText!: Phaser.GameObjects.Text;
    private previewText!: Phaser.GameObjects.Text;
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
        this.previewText = this.add.text(32, 96, '', {
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '14px'
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
        const hpText = this.add.text(0, 40, this.formatHp(unit), {
            color: '#dcffe0',
            fontFamily: 'Arial',
            fontSize: '11px',
            stroke: '#182331',
            strokeThickness: 3
        }).setOrigin(0.5);
        const sprite = this.add.container(0, 0, [circle, label, hpText]).setSize(TILE_SIZE, TILE_SIZE).setInteractive();
        sprite.on('pointerdown', () => this.handleUnitClick(unit));
        sprite.on('pointerover', () => this.handleUnitHover(unit));
        sprite.on('pointerout', () => this.clearPreview());
        this.unitSprites.set(unit.id, sprite);
        this.unitCircles.set(unit.id, circle);
        this.unitHpTexts.set(unit.id, hpText);
        this.boardLayer.add(sprite);
        this.placeUnitSprite(unit);
    }

    private handleUnitClick(unit: UnitData): void {
        if (unit.faction === 'player') {
            this.selectPlayerUnit(unit);
            return;
        }

        if (this.selectedUnit !== undefined && this.attackable.has(unit.id)) {
            this.executeAttack(this.selectedUnit, unit);
            return;
        }

        this.statusText.setText(`${unit.name} est une unité ennemie. Sélectionnez une unité alliée à portée pour l'attaquer.`);
    }

    private selectPlayerUnit(unit: UnitData): void {
        this.selectedUnit = unit;
        const occupied = new Set(this.livingUnits().map((item) => this.grid.key({ x: item.x, y: item.y })));
        this.reachable = new Set(this.grid.reachableFrom(unit, unit.movement, occupied).map((point) => this.grid.key(point)));
        this.attackable = this.computeAttackable(unit);
        this.clearPreview();
        this.refreshHighlights();

        const targetInfo = this.attackable.size > 0
            ? `${this.attackable.size} cible(s) à portée : cliquez un ennemi surligné pour attaquer.`
            : 'Aucune cible à portée.';
        this.statusText.setText(`${unit.name} • ${unit.classId.replace('class:', '')} • déplacement ${unit.movement}. ${targetInfo}`);
    }

    private handleTileClick(point: GridPoint): void {
        if (this.selectedUnit === undefined || !this.reachable.has(this.grid.key(point))) {
            return;
        }

        const occupiedByOtherUnit = this.livingUnits().some((unit) =>
            unit.id !== this.selectedUnit?.id && unit.x === point.x && unit.y === point.y
        );
        if (occupiedByOtherUnit) {
            return;
        }

        this.selectedUnit.x = point.x;
        this.selectedUnit.y = point.y;
        this.placeUnitSprite(this.selectedUnit);
        this.reachable.clear();
        this.attackable.clear();
        this.clearPreview();
        this.refreshHighlights();
        this.statusText.setText(`${this.selectedUnit.name} a rejoint la case ${point.x + 1},${point.y + 1}.`);
        this.selectedUnit = undefined;
    }

    private computeAttackable(unit: UnitData): Map<string, UnitData> {
        const attackable = new Map<string, UnitData>();
        for (const other of this.livingUnits()) {
            if (other.faction === unit.faction) {
                continue;
            }
            const distance = manhattanDistance(unit, other);
            if (isInWeaponRange(unit.weapon, distance)) {
                attackable.set(other.id, other);
            }
        }
        return attackable;
    }

    private handleUnitHover(unit: UnitData): void {
        if (this.selectedUnit === undefined || !this.attackable.has(unit.id)) {
            return;
        }

        const preview = previewCombat(
            this.selectedUnit,
            unit,
            this.terrainBonusFor(this.selectedUnit),
            this.terrainBonusFor(unit)
        );
        this.previewText.setText(this.formatPreview(this.selectedUnit, unit, preview));
    }

    private clearPreview(): void {
        this.previewText.setText('');
    }

    private executeAttack(attacker: UnitData, defender: UnitData): void {
        const result = resolveCombat(
            attacker,
            defender,
            this.terrainBonusFor(attacker),
            this.terrainBonusFor(defender)
        );

        attacker.stats.hp = result.attackerHpAfter;
        defender.stats.hp = result.defenderHpAfter;
        this.updateUnitHp(attacker);
        this.updateUnitHp(defender);

        if (result.defenderDefeated) {
            this.removeUnit(defender);
        }
        if (result.attackerDefeated) {
            this.removeUnit(attacker);
        }

        this.statusText.setText(this.formatResult(attacker, defender, result));
        this.clearPreview();
        this.reachable.clear();
        this.attackable.clear();
        this.selectedUnit = undefined;
        this.refreshHighlights();
    }

    private updateUnitHp(unit: UnitData): void {
        this.unitHpTexts.get(unit.id)?.setText(this.formatHp(unit));
    }

    private removeUnit(unit: UnitData): void {
        this.unitSprites.get(unit.id)?.destroy();
        this.unitSprites.delete(unit.id);
        this.unitCircles.delete(unit.id);
        this.unitHpTexts.delete(unit.id);
        const index = this.chapter.units.findIndex((item) => item.id === unit.id);
        if (index !== -1) {
            this.chapter.units.splice(index, 1);
        }
    }

    private terrainBonusFor(unit: UnitData): TerrainCombatBonus {
        const terrain = this.grid.terrainAt({ x: unit.x, y: unit.y });
        return terrain === undefined ? { defense: 0, avoid: 0 } : { defense: terrain.defense, avoid: terrain.avoid };
    }

    private livingUnits(): UnitData[] {
        return this.chapter.units.filter((unit) => unit.stats.hp > 0);
    }

    private formatHp(unit: UnitData): string {
        return `${unit.stats.hp}/${unit.stats.maxHp} PV`;
    }

    private formatPreview(attacker: UnitData, defender: UnitData, preview: CombatPreview): string {
        const lines = [
            `${attacker.name} → ${defender.name} : ${preview.attackerDamage} dégâts, ${preview.attackerHitChance}% touche, ${preview.attackerCritChance}% critique${preview.attackerDoubles ? ' (double attaque)' : ''}`
        ];
        if (preview.defenderCanCounter) {
            lines.push(
                `Contre : ${defender.name} → ${attacker.name} : ${preview.defenderDamage} dégâts, ${preview.defenderHitChance}% touche${preview.defenderDoubles ? ' (double attaque)' : ''}`
            );
        } else {
            lines.push(`${defender.name} ne peut pas contre-attaquer à cette portée.`);
        }
        return lines.join('\n');
    }

    private formatResult(attacker: UnitData, defender: UnitData, result: CombatResult): string {
        const parts = result.rounds.map((round) => {
            const actorName = round.actor === 'attacker' ? attacker.name : defender.name;
            if (!round.hit) {
                return `${actorName} rate son attaque.`;
            }
            const critLabel = round.critical ? ' critique !' : '';
            return `${actorName} inflige ${round.damage} dégâts${critLabel}`;
        });

        if (result.defenderDefeated) {
            parts.push(`${defender.name} est vaincu.`);
        }
        if (result.attackerDefeated) {
            parts.push(`${attacker.name} est vaincu.`);
        }

        return parts.join(' ');
    }

    private placeUnitSprite(unit: UnitData): void {
        this.unitSprites.get(unit.id)?.setPosition(
            BOARD_ORIGIN.x + unit.x * TILE_SIZE + TILE_SIZE / 2,
            BOARD_ORIGIN.y + unit.y * TILE_SIZE + TILE_SIZE / 2
        );
    }

    private refreshHighlights(): void {
        const attackablePoints = new Set(
            [...this.attackable.values()].map((unit) => this.grid.key({ x: unit.x, y: unit.y }))
        );

        this.boardLayer?.each((child) => {
            const tile = child as Phaser.GameObjects.Rectangle;
            if (!(tile instanceof Phaser.GameObjects.Rectangle)) {
                return;
            }
            const point = {
                x: Math.round((tile.x - BOARD_ORIGIN.x - TILE_SIZE / 2) / TILE_SIZE),
                y: Math.round((tile.y - BOARD_ORIGIN.y - TILE_SIZE / 2) / TILE_SIZE)
            };
            const key = this.grid.key(point);
            const isReachable = this.reachable.has(key);
            const isAttackable = attackablePoints.has(key);

            if (isAttackable) {
                tile.setAlpha(0.75);
                tile.setStrokeStyle(4, 0xff5b5b, 1);
            } else {
                tile.setAlpha(isReachable ? 0.75 : 1);
                tile.setStrokeStyle(isReachable ? 3 : 1, isReachable ? 0xf8e7bd : 0x263644, 0.9);
            }
        });
    }
}
