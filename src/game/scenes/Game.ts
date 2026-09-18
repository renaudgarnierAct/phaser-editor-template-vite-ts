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
import { loadRpgData } from '../data/loadRpgData';
import { indexRpgData } from '../data/rpgData';
import type { ItemDefinition } from '../data/items';
import { addItem, createEmptyInventory } from '../systems/InventorySystem';
import { createConvoy, type Convoy } from '../systems/ConvoySystem';
import {
    canAct,
    executeUnitCommand,
    UnitCommandError,
    type CommandUnit,
    type UnitCommand
} from '../systems/UnitCommandSystem';
import { createProceduralTerrainTile, isTerrainTileKind } from '../rendering/ProceduralTerrainTile';

const TILE_SIZE = 56;
const BOARD_ORIGIN = { x: 32, y: 130 };

type TurnPhase = 'player' | 'enemy';

interface CommandButton {
    text: Phaser.GameObjects.Text;
    enabled: boolean;
}

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
    private readonly tileOverlays = new Map<Phaser.GameObjects.Rectangle, GridPoint>();
    private statusText!: Phaser.GameObjects.Text;
    private previewText!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;
    private endTurnButton!: Phaser.GameObjects.Text;
    private boardLayer!: Phaser.GameObjects.Container;
    private battlePopup?: BattlePopup;
    private commandTitle!: Phaser.GameObjects.Text;
    private commandHint!: Phaser.GameObjects.Text;
    private readonly commandButtons = new Map<UnitCommand['type'], CommandButton>();
    private readonly commandUnits = new Map<string, CommandUnit>();
    private itemsById: ReadonlyMap<string, ItemDefinition> = new Map();
    private readonly itemEffects = new Map([
        ['item:vulnerary', { kind: 'restore_hp' as const, amount: 10 }],
        ['item:elixir', { kind: 'restore_hp' as const, amount: 99 }]
    ]);
    private convoy: Convoy = createConvoy();
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
        this.createCommandUi();
        this.updateTurnUi();
        this.loadChapter();
    }

    private async loadChapter(): Promise<void> {
        try {
            const [chapter, rpgData] = await Promise.all([
                loadChapter('/data/chapter-01.json'),
                loadRpgData('/data/rpg-progression-sample.json')
            ]);
            this.chapter = chapter;
            this.itemsById = indexRpgData(rpgData).itemsById;
            this.initializeCommandUnits();
            this.grid = new GridSystem(this.chapter);
            this.board = createBoardQuery(this.chapter, this.grid);
            this.aiProfiles = await this.loadAIProfilesSafely();
            this.renderBoard();
            this.statusText.setText('Sélectionnez une unité bleue pour afficher ses déplacements.');
            this.refreshCommandUi();
        } catch (error) {
            this.statusText.setColor('#ff9b9b');
            this.statusText.setText('Erreur de chargement des données tactiques (chapitre ou objets).');
            console.error(error);
        }
    }

    private initializeCommandUnits(): void {
        const starterItem = this.itemsById.get('item:vulnerary');
        for (const unit of this.chapter.units) {
            let inventory = createEmptyInventory();
            if (unit.faction === 'player' && starterItem !== undefined) {
                inventory = addItem(inventory, starterItem, 1).inventory;
            }
            this.commandUnits.set(unit.id, {
                id: unit.id,
                faction: unit.faction,
                hp: unit.stats.hp,
                maxHp: unit.stats.maxHp,
                inventory,
                hasActed: false
            });
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

    private createCommandUi(): void {
        this.add.rectangle(864, 344, 256, 428, 0x101a25, 0.92)
            .setStrokeStyle(2, 0x596b7d, 1);
        this.commandTitle = this.add.text(752, 150, 'COMMANDES', {
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '18px',
            fontStyle: 'bold'
        });
        this.createCommandButton('wait', 190, 'Attendre', () => this.executeWait());
        this.createCommandButton('use_item', 238, 'Utiliser un objet', () => this.executeUseItem());
        this.createCommandButton('trade', 286, 'Échanger', () => this.executeTrade());
        this.commandHint = this.add.text(752, 342, 'Sélectionnez une unité alliée.', {
            color: '#9fb0c1',
            fontFamily: 'Arial',
            fontSize: '13px',
            lineSpacing: 5,
            wordWrap: { width: 224 }
        });
        this.refreshCommandUi();
    }

    private createCommandButton(
        command: UnitCommand['type'],
        y: number,
        label: string,
        action: () => void
    ): void {
        const text = this.add.text(752, y, label, {
            color: '#182331',
            backgroundColor: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '15px',
            fontStyle: 'bold',
            fixedWidth: 224,
            align: 'center',
            padding: { x: 10, y: 9 }
        });
        text.on('pointerdown', action);
        this.commandButtons.set(command, { text, enabled: true });
    }

    private refreshCommandUi(): void {
        if (this.commandTitle === undefined || this.commandHint === undefined) {
            return;
        }

        const actor = this.selectedUnit === undefined ? undefined : this.commandUnits.get(this.selectedUnit.id);
        const actorCanAct = this.phase === 'player' && canAct(actor);
        const usableSlot = actorCanAct ? this.findUsableItemSlot(actor) : undefined;
        const trade = actorCanAct && this.selectedUnit !== undefined
            ? this.findTradeOption(this.selectedUnit, actor)
            : undefined;

        this.setCommandEnabled('wait', actorCanAct);
        this.setCommandEnabled('use_item', actorCanAct && usableSlot !== undefined);
        this.setCommandEnabled('trade', actorCanAct && trade !== undefined);

        if (this.selectedUnit === undefined) {
            this.commandTitle.setText('COMMANDES');
            this.commandHint.setText('Sélectionnez une unité alliée.');
            return;
        }

        this.commandTitle.setText(`COMMANDES • ${this.selectedUnit.name}`);
        if (!actorCanAct) {
            this.commandHint.setText('Indisponible : cette unité ne peut plus agir pendant ce tour.');
            return;
        }

        const itemReason = usableSlot === undefined
            ? 'Objet désactivé : aucun soin utilisable ou PV déjà au maximum.'
            : `Objet prêt : ${this.itemNameInSlot(actor, usableSlot)}.`;
        const tradeReason = trade === undefined
            ? 'Échange désactivé : aucun objet ou allié adjacent disponible.'
            : `Échange prêt avec ${trade.target.name} : ${this.itemNameInSlot(actor, trade.slotIndex)}.`;
        this.commandHint.setText(`${itemReason}\n\n${tradeReason}`);
    }

    private setCommandEnabled(command: UnitCommand['type'], enabled: boolean): void {
        const button = this.commandButtons.get(command);
        if (button === undefined || button.enabled === enabled) {
            return;
        }
        button.enabled = enabled;
        if (enabled) {
            button.text
                .setInteractive({ useHandCursor: true })
                .setAlpha(1)
                .setColor('#182331')
                .setBackgroundColor('#f8e7bd');
        } else {
            button.text
                .disableInteractive()
                .setAlpha(0.45)
                .setColor('#9aa7b5')
                .setBackgroundColor('#334252');
        }
    }

    private executeWait(): void {
        if (this.selectedUnit === undefined) {
            return;
        }
        const actor = this.selectedUnit;
        if (this.executeCommand({ type: 'wait', actorId: actor.id })) {
            this.statusText.setText(`${actor.name} attend et termine son action.`);
        }
    }

    private executeUseItem(): void {
        if (this.selectedUnit === undefined) {
            return;
        }
        const actor = this.commandUnits.get(this.selectedUnit.id);
        const slotIndex = this.findUsableItemSlot(actor);
        if (actor === undefined || slotIndex === undefined) {
            this.showCommandError('Aucun objet utilisable pour cette unité.');
            return;
        }

        const unit = this.selectedUnit;
        const itemName = this.itemNameInSlot(actor, slotIndex);
        if (this.executeCommand({ type: 'use_item', actorId: unit.id, slotIndex })) {
            this.statusText.setText(`${unit.name} utilise ${itemName} et récupère des PV.`);
        }
    }

    private executeTrade(): void {
        if (this.selectedUnit === undefined) {
            return;
        }
        const actor = this.commandUnits.get(this.selectedUnit.id);
        const trade = actor === undefined ? undefined : this.findTradeOption(this.selectedUnit, actor);
        if (actor === undefined || trade === undefined) {
            this.showCommandError('Échange impossible : aucun objet ou allié adjacent disponible.');
            return;
        }

        const sceneUnit = this.selectedUnit;
        const itemName = this.itemNameInSlot(actor, trade.slotIndex);
        if (this.executeCommand({
            type: 'trade',
            actorId: sceneUnit.id,
            slotIndex: trade.slotIndex,
            destination: { kind: 'unit', unitId: trade.target.id }
        })) {
            this.statusText.setText(`${sceneUnit.name} donne ${itemName} à ${trade.target.name}.`);
        }
    }

    private executeCommand(command: UnitCommand): boolean {
        try {
            const result = executeUnitCommand({
                units: this.commandUnits,
                itemsById: this.itemsById,
                itemEffects: this.itemEffects,
                convoy: this.convoy
            }, command);
            this.commandUnits.clear();
            result.units.forEach((unit, id) => this.commandUnits.set(id, unit));
            this.convoy = result.convoy ?? this.convoy;
            this.syncUnitsFromCommandState();
            this.finishSelectedUnitAction();
            return true;
        } catch (error) {
            if (error instanceof UnitCommandError) {
                this.showCommandError(`Commande refusée (${error.code}) : ${error.message}`);
                return false;
            }
            console.error(error);
            this.showCommandError('Erreur inattendue pendant l’exécution de la commande.');
            return false;
        }
    }

    private syncUnitsFromCommandState(): void {
        for (const unit of this.livingUnits()) {
            const commandUnit = this.commandUnits.get(unit.id);
            if (commandUnit === undefined) {
                continue;
            }
            unit.stats.hp = commandUnit.hp;
            this.updateUnitHp(unit);
            if (commandUnit.hasActed) {
                this.actedUnitIds.add(unit.id);
                this.unitSprites.get(unit.id)?.setAlpha(0.5);
            }
        }
    }

    private finishSelectedUnitAction(): void {
        this.selectedUnit = undefined;
        this.reachable.clear();
        this.attackable.clear();
        this.clearPreview();
        this.refreshHighlights();
        this.refreshCommandUi();
    }

    private showCommandError(message: string): void {
        this.statusText.setColor('#ff9b9b').setText(message);
        this.time.delayedCall(2200, () => this.statusText.setColor('#b9c7d6'));
    }

    private findUsableItemSlot(unit: CommandUnit | undefined): number | undefined {
        if (unit === undefined || unit.hp >= unit.maxHp) {
            return undefined;
        }
        const slotIndex = unit.inventory.slots.findIndex((stack) => {
            if (stack === null) {
                return false;
            }
            return this.itemsById.get(stack.itemId)?.kind === 'consumable'
                && this.itemEffects.has(stack.itemId);
        });
        return slotIndex === -1 ? undefined : slotIndex;
    }

    private findTradeOption(
        sceneUnit: UnitData,
        commandUnit: CommandUnit
    ): { slotIndex: number; target: UnitData } | undefined {
        const slotIndex = commandUnit.inventory.slots.findIndex((stack) => stack !== null);
        if (slotIndex === -1) {
            return undefined;
        }
        const target = this.livingUnits().find((unit) =>
            unit.id !== sceneUnit.id
            && unit.faction === sceneUnit.faction
            && Math.max(Math.abs(unit.x - sceneUnit.x), Math.abs(unit.y - sceneUnit.y)) === 1
        );
        return target === undefined ? undefined : { slotIndex, target };
    }

    private itemNameInSlot(unit: CommandUnit, slotIndex: number): string {
        const stack = unit.inventory.slots[slotIndex];
        return stack === null || stack === undefined
            ? 'objet inconnu'
            : this.itemsById.get(stack.itemId)?.name ?? stack.itemId;
    }

    private renderBoard(): void {
        this.boardLayer = this.add.container(0, 0);
        this.tileOverlays.clear();
        for (let y = 0; y < this.chapter.map.height; y += 1) {
            for (let x = 0; x < this.chapter.map.width; x += 1) {
                const terrain = this.grid.terrainAt({ x, y });
                const terrainId = this.grid.terrainIdAt({ x, y });
                if (terrain === undefined || terrainId === undefined) {
                    continue;
                }

                if (isTerrainTileKind(terrainId)) {
                    const terrainSprite = createProceduralTerrainTile(this, terrainId, {
                        x: BOARD_ORIGIN.x + x * TILE_SIZE,
                        y: BOARD_ORIGIN.y + y * TILE_SIZE,
                        size: TILE_SIZE,
                        gridX: x,
                        gridY: y
                    });
                    this.boardLayer.add(terrainSprite);
                } else {
                    const fallback = this.add.rectangle(
                        BOARD_ORIGIN.x + x * TILE_SIZE + TILE_SIZE / 2,
                        BOARD_ORIGIN.y + y * TILE_SIZE + TILE_SIZE / 2,
                        TILE_SIZE,
                        TILE_SIZE,
                        terrain.color
                    );
                    this.boardLayer.add(fallback);
                }

                const tile = this.add.rectangle(
                    BOARD_ORIGIN.x + x * TILE_SIZE + TILE_SIZE / 2,
                    BOARD_ORIGIN.y + y * TILE_SIZE + TILE_SIZE / 2,
                    TILE_SIZE,
                    TILE_SIZE,
                    0xffffff,
                    0
                ).setStrokeStyle(1, 0x263644, 0.8).setInteractive();
                tile.on('pointerdown', () => this.handleTileClick({ x, y }));
                this.tileOverlays.set(tile, { x, y });
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
            if (!canAct(this.commandUnits.get(unit.id))) {
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
        this.refreshCommandUi();

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
        this.refreshCommandUi();
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
                this.refreshCommandUi();
            },
            onComplete: () => {
                this.battlePopup = undefined;
                this.clearPreview();
                this.reachable.clear();
                this.attackable.clear();
                this.selectedUnit = undefined;
                this.refreshHighlights();
                this.refreshCommandUi();
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
        this.updateCommandUnitHp(attacker);
        this.updateCommandUnitHp(defender);
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
        this.commandUnits.delete(unit.id);
        const index = this.chapter.units.findIndex((item) => item.id === unit.id);
        if (index !== -1) {
            this.chapter.units.splice(index, 1);
        }
    }

    private markUnitActed(unit: UnitData): void {
        this.actedUnitIds.add(unit.id);
        this.unitSprites.get(unit.id)?.setAlpha(0.5);
        const commandUnit = this.commandUnits.get(unit.id);
        if (commandUnit !== undefined) {
            this.commandUnits.set(unit.id, { ...commandUnit, hasActed: true });
        }
    }

    private resetActedVisuals(): void {
        this.actedUnitIds.clear();
        this.unitSprites.forEach((sprite) => sprite.setAlpha(1));
        for (const [id, unit] of this.commandUnits) {
            this.commandUnits.set(id, { ...unit, hasActed: false });
        }
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
        this.refreshCommandUi();

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
        this.refreshCommandUi();
    }

    private updateCommandUnitHp(unit: UnitData): void {
        const commandUnit = this.commandUnits.get(unit.id);
        if (commandUnit !== undefined) {
            this.commandUnits.set(unit.id, { ...commandUnit, hp: unit.stats.hp });
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

        this.tileOverlays.forEach((point, tile) => {
            const key = this.grid.key(point);
            const isReachable = this.reachable.has(key);
            const isAttackable = attackablePoints.has(key);

            if (isAttackable) {
                tile.setFillStyle(0xff5b5b, 0.22);
                tile.setStrokeStyle(4, 0xff5b5b, 1);
            } else {
                tile.setFillStyle(isReachable ? 0xf8e7bd : 0xffffff, isReachable ? 0.2 : 0);
                tile.setStrokeStyle(isReachable ? 3 : 1, isReachable ? 0xf8e7bd : 0x263644, 0.9);
            }
        });
    }
}
