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
import { createPixelUnitSprite } from '../rendering/PixelUnitSprite';
import { createBoardQuery } from '../ai/board';
import { decideAction } from '../ai/decide';
import { loadAIChapterFile, resolveAIProfile, type AIProfileMap } from '../ai/loadAIProfiles';
import type { AIBoardQuery, AIDecision } from '../ai/types';
import { BattlePopup } from '../ui/BattlePopup';

const TILE_SIZE = 56;
const BOARD_ORIGIN = { x: 32, y: 130 };

type TurnPhase = 'player' | 'enemy';

export default class Game extends Phaser.Scene {
    private chapter!: ChapterData;
    private grid!: GridSystem;
    private board!: AIBoardQuery;
    private aiProfiles: AIProfileMap = new Map();
    private selectedUnit?: UnitData;
    private reachable = new Set<string>();
    private attackable = new Map<string, UnitData>();
    private readonly unitSprites = new Map<string, Phaser.GameObjects.Container>();
    private readonly unitCircles = new Map<string, Phaser.GameObjects.Arc>();
    private readonly unitHpTexts = new Map<string, Phaser.GameObjects.Text>();
    private statusText!: Phaser.GameObjects.Text;
    private previewText!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;
    private endTurnButton!: Phaser.GameObjects.Text;
    private boardLayer!: Phaser.GameObjects.Container;
    private battlePopup?: BattlePopup;
    private phase: TurnPhase = 'player';
    private turnNumber = 1;
    private readonly actedUnitIds = new Set<string>();

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
        this.turnText = this.add.text(992, 28, '', {
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '18px',
            fontStyle: 'bold'
        }).setOrigin(1, 0);
        this.endTurnButton = this.add.text(992, 56, 'Fin du tour', {
            color: '#182331',
            backgroundColor: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            padding: { x: 12, y: 6 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        this.endTurnButton.on('pointerdown', () => this.endPlayerTurn());
        this.updateTurnUi();
        this.loadChapter();
    }

    private async loadChapter(): Promise<void> {
        try {
            this.chapter = await loadChapter('/data/chapter-01.json');
            this.grid = new GridSystem(this.chapter);
            this.board = createBoardQuery(this.chapter, this.grid);
            this.aiProfiles = await this.loadAIProfilesSafely();
            this.renderBoard();
            this.statusText.setText('Sélectionnez une unité bleue pour afficher ses déplacements.');
        } catch (error) {
            this.statusText.setColor('#ff9b9b');
            this.statusText.setText('Erreur de chargement des données de chapitre.');
            console.error(error);
        }
    }

    private async loadAIProfilesSafely(): Promise<AIProfileMap> {
        try {
            return await loadAIChapterFile('/data/ai-chapter-01.json');
        } catch (error) {
            console.warn('Impossible de charger les profils IA, utilisation du comportement par défaut.', error);
            return new Map();
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
        const pixelSprite = createPixelUnitSprite(this, unit);
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
        const sprite = this.add.container(0, 0, [circle, pixelSprite, label, hpText]).setSize(TILE_SIZE, TILE_SIZE).setInteractive();
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
        if (this.phase !== 'player') {
            return;
        }

        if (unit.faction === 'player') {
            if (this.actedUnitIds.has(unit.id)) {
                this.statusText.setText(`${unit.name} a déjà agi ce tour-ci.`);
                return;
            }
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
        if (this.phase !== 'player' || this.selectedUnit === undefined || !this.reachable.has(this.grid.key(point))) {
            return;
        }

        const occupiedByOtherUnit = this.livingUnits().some((unit) =>
            unit.id !== this.selectedUnit?.id && unit.x === point.x && unit.y === point.y
        );
        if (occupiedByOtherUnit) {
            return;
        }

        const movedUnit = this.selectedUnit;
        movedUnit.x = point.x;
        movedUnit.y = point.y;
        this.placeUnitSprite(movedUnit);
        this.markUnitActed(movedUnit);
        this.reachable.clear();
        this.attackable.clear();
        this.clearPreview();
        this.refreshHighlights();
        this.statusText.setText(`${movedUnit.name} a rejoint la case ${point.x + 1},${point.y + 1}.`);
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
        if (this.battlePopup !== undefined) {
            return;
        }

        const result = resolveCombat(
            attacker,
            defender,
            this.terrainBonusFor(attacker),
            this.terrainBonusFor(defender)
        );
        this.battlePopup = new BattlePopup(this, {
            title: 'COMBAT',
            left: {
                name: attacker.name,
                className: attacker.classId.replace('class:', ''),
                hp: attacker.stats.hp,
                maxHp: attacker.stats.maxHp,
                damage: result.attackerDamage,
                hit: result.attackerHitChance,
                critical: result.attackerCritChance,
                color: attacker.color
            },
            right: {
                name: defender.name,
                className: defender.classId.replace('class:', ''),
                hp: defender.stats.hp,
                maxHp: defender.stats.maxHp,
                damage: result.defenderDamage,
                hit: result.defenderHitChance,
                critical: result.defenderCritChance,
                color: defender.color
            },
            exchanges: result.rounds.map((round) => ({
                actor: round.actor === 'attacker' ? 'left' : 'right',
                hit: round.hit,
                critical: round.critical,
                damage: round.damage,
                targetHpAfter: round.targetHpAfter
            })),
            onConfirm: () => {
                this.applyCombatResult(attacker, defender, result);
                this.markUnitActed(attacker);
                this.statusText.setText(this.formatResult(attacker, defender, result));
            },
            onCancel: () => {
                this.battlePopup = undefined;
                this.statusText.setText('Combat annulé.');
            },
            onComplete: () => {
                this.battlePopup = undefined;
                this.clearPreview();
                this.reachable.clear();
                this.attackable.clear();
                this.selectedUnit = undefined;
                this.refreshHighlights();
            }
        });
    }

    private applyCombat(attacker: UnitData, defender: UnitData): CombatResult {
        const result = resolveCombat(
            attacker,
            defender,
            this.terrainBonusFor(attacker),
            this.terrainBonusFor(defender)
        );

        this.applyCombatResult(attacker, defender, result);
        return result;
    }

    private applyCombatResult(attacker: UnitData, defender: UnitData, result: CombatResult): void {
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

    }

    private updateUnitHp(unit: UnitData): void {
        this.unitHpTexts.get(unit.id)?.setText(this.formatHp(unit));
    }

    private removeUnit(unit: UnitData): void {
        this.unitSprites.get(unit.id)?.destroy();
        this.unitSprites.delete(unit.id);
        this.unitCircles.delete(unit.id);
        this.unitHpTexts.delete(unit.id);
        this.actedUnitIds.delete(unit.id);
        const index = this.chapter.units.findIndex((item) => item.id === unit.id);
        if (index !== -1) {
            this.chapter.units.splice(index, 1);
        }
    }

    private markUnitActed(unit: UnitData): void {
        this.actedUnitIds.add(unit.id);
        this.unitSprites.get(unit.id)?.setAlpha(0.5);
    }

    private resetActedVisuals(): void {
        this.actedUnitIds.clear();
        this.unitSprites.forEach((sprite) => sprite.setAlpha(1));
    }

    private updateTurnUi(): void {
        const phaseLabel = this.phase === 'player' ? 'Phase Joueur' : 'Phase Ennemie';
        this.turnText.setText(`Tour ${this.turnNumber} • ${phaseLabel}`);
    }

    /** Ends the player phase and hands control to the enemy AI phase, then returns to the player. */
    private endPlayerTurn(): void {
        if (this.phase !== 'player') {
            return;
        }

        this.selectedUnit = undefined;
        this.reachable.clear();
        this.attackable.clear();
        this.clearPreview();
        this.refreshHighlights();

        this.phase = 'enemy';
        this.endTurnButton.disableInteractive().setAlpha(0.4);
        this.updateTurnUi();

        this.runEnemyPhase();
    }

    /** Resolves every living enemy unit's action for this turn using the existing AI decision system, then starts the next player turn. */
    private runEnemyPhase(): void {
        const log: string[] = [];
        const enemyUnits = this.livingUnits().filter((unit) => unit.faction === 'enemy');

        for (const unit of enemyUnits) {
            if (unit.stats.hp <= 0) {
                continue;
            }
            const profile = resolveAIProfile(unit.id, this.aiProfiles);
            const decision = decideAction(unit, profile, this.board);
            log.push(this.applyEnemyDecision(unit, decision));
        }

        this.statusText.setText(log.length > 0 ? log.join(' ') : "Aucune unité ennemie n'a pu agir.");
        this.clearPreview();
        this.startPlayerTurn();
    }

    /** Applies a single AI decision (move and/or attack) using the same movement and combat systems as the player. */
    private applyEnemyDecision(unit: UnitData, decision: AIDecision): string {
        if (decision.moveTo !== undefined && (decision.moveTo.x !== unit.x || decision.moveTo.y !== unit.y)) {
            unit.x = decision.moveTo.x;
            unit.y = decision.moveTo.y;
            this.placeUnitSprite(unit);
        }

        if (decision.action === 'attack' && decision.target !== undefined) {
            const result = this.applyCombat(unit, decision.target);
            return this.formatResult(unit, decision.target, result);
        }

        if (decision.action === 'move') {
            return `${unit.name} se replace.`;
        }

        return `${unit.name} attend.`;
    }

    private startPlayerTurn(): void {
        this.phase = 'player';
        this.turnNumber += 1;
        this.resetActedVisuals();
        this.endTurnButton.setInteractive({ useHandCursor: true }).setAlpha(1);
        this.updateTurnUi();
        this.refreshHighlights();
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
