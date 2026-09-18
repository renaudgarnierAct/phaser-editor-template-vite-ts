import * as Phaser from 'phaser';

export type BattlePopupSide = 'left' | 'right';

export interface BattlePopupFighter {
    name: string;
    className: string;
    hp: number;
    maxHp: number;
    damage: number;
    hit: number;
    critical: number;
    color?: number;
    accentColor?: number;
}

export interface BattlePopupExchange {
    actor: BattlePopupSide;
    hit: boolean;
    critical?: boolean;
    damage: number;
    targetHpAfter: number;
}

export interface BattlePopupCallbacks {
    onConfirm?: () => void;
    onCancel?: () => void;
    onComplete?: () => void;
}

export interface BattlePopupConfig extends BattlePopupCallbacks {
    left: BattlePopupFighter;
    right: BattlePopupFighter;
    exchanges: readonly BattlePopupExchange[];
    title?: string;
    depth?: number;
}

type PopupState = 'entering' | 'preview' | 'playing' | 'closing' | 'destroyed';

const COLORS = {
    backdrop: 0x080d18,
    panel: 0x17233a,
    panelBorder: 0xbcc9e8,
    text: '#f6f2df',
    muted: '#aab8d4',
    hp: 0x55d66b,
    hpLow: 0xe45454,
    hpTrack: 0x3a2430,
    button: 0x2c4165,
    buttonFocus: 0x496eaa,
    flash: 0xffffff
} as const;

class FighterPanel extends Phaser.GameObjects.Container {
    private readonly hpFill: Phaser.GameObjects.Rectangle;
    private readonly hpText: Phaser.GameObjects.Text;
    private readonly portrait: Phaser.GameObjects.Container;
    private currentHp: number;

    constructor(
        scene: Phaser.Scene,
        x: number,
        fighter: BattlePopupFighter,
        side: BattlePopupSide
    ) {
        super(scene, x, 0);
        this.currentHp = Phaser.Math.Clamp(fighter.hp, 0, fighter.maxHp);

        const primary = fighter.color ?? (side === 'left' ? 0x3e8edb : 0xc34e5d);
        const accent = fighter.accentColor ?? (side === 'left' ? 0x9dd9ff : 0xffb0a9);
        const background = scene.add.rectangle(0, 0, 310, 250, COLORS.panel, 0.98)
            .setStrokeStyle(3, primary);

        this.portrait = this.createPortrait(scene, side, primary, accent);
        this.portrait.setPosition(side === 'left' ? -105 : 105, -42);

        const textX = side === 'left' ? -58 : -132;
        const originX = side === 'left' ? 0 : 1;
        const name = scene.add.text(textX, -105, fighter.name, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: COLORS.text,
            fontStyle: 'bold'
        }).setOrigin(originX, 0);
        const className = scene.add.text(textX, -74, fighter.className, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: COLORS.muted
        }).setOrigin(originX, 0);

        const hpTrack = scene.add.rectangle(-118, 30, 236, 18, COLORS.hpTrack).setOrigin(0, 0.5);
        this.hpFill = scene.add.rectangle(-118, 30, 236, 14, COLORS.hp).setOrigin(0, 0.5);
        this.hpText = scene.add.text(0, 47, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: COLORS.text,
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const stats = [
            ['DMG', fighter.damage],
            ['HIT', fighter.hit],
            ['CRIT', fighter.critical]
        ] as const;
        const statObjects = stats.flatMap(([label, value], index) => {
            const statX = -104 + index * 104;
            return [
                scene.add.text(statX, 84, label, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '13px',
                    color: COLORS.muted
                }).setOrigin(0.5),
                scene.add.text(statX, 107, `${value}${label === 'DMG' ? '' : '%'}`, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '20px',
                    color: COLORS.text,
                    fontStyle: 'bold'
                }).setOrigin(0.5)
            ];
        });

        this.add([background, this.portrait, name, className, hpTrack, this.hpFill, this.hpText, ...statObjects]);
        this.updateHp(this.currentHp, fighter.maxHp);
    }

    getPortrait(): Phaser.GameObjects.Container {
        return this.portrait;
    }

    updateHp(hp: number, maxHp: number): void {
        this.currentHp = Phaser.Math.Clamp(hp, 0, maxHp);
        const ratio = maxHp > 0 ? this.currentHp / maxHp : 0;
        this.hpFill.width = 236 * ratio;
        this.hpFill.setFillStyle(ratio <= 0.25 ? COLORS.hpLow : COLORS.hp);
        this.hpText.setText(`${this.currentHp} / ${maxHp} HP`);
    }

    private createPortrait(
        scene: Phaser.Scene,
        side: BattlePopupSide,
        primary: number,
        accent: number
    ): Phaser.GameObjects.Container {
        const portrait = scene.add.container(0, 0);
        const silhouette = scene.add.graphics();
        silhouette.fillStyle(accent, 1);
        silhouette.fillCircle(0, -18, 22);
        silhouette.fillStyle(primary, 1);
        silhouette.fillRoundedRect(-36, 5, 72, 58, 10);
        silhouette.fillTriangle(
            side === 'left' ? 30 : -30, 14,
            side === 'left' ? 58 : -58, 30,
            side === 'left' ? 30 : -30, 45
        );
        silhouette.lineStyle(3, COLORS.panelBorder, 0.9);
        silhouette.strokeCircle(0, -18, 22);
        silhouette.strokeRoundedRect(-36, 5, 72, 58, 10);
        portrait.add(silhouette);
        return portrait;
    }
}

class PopupButton extends Phaser.GameObjects.Container {
    private readonly background: Phaser.GameObjects.Rectangle;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        label: string,
        onActivate: () => void
    ) {
        super(scene, x, y);
        this.background = scene.add.rectangle(0, 0, width, 42, COLORS.button)
            .setStrokeStyle(2, COLORS.panelBorder)
            .setInteractive({ useHandCursor: true });
        const text = scene.add.text(0, 0, label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: COLORS.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.background.on('pointerover', () => this.background.setFillStyle(COLORS.buttonFocus));
        this.background.on('pointerout', () => this.background.setFillStyle(COLORS.button));
        this.background.on('pointerup', onActivate);
        this.add([this.background, text]);
    }

    setEnabled(enabled: boolean): void {
        this.setAlpha(enabled ? 1 : 0.45);
        if (enabled) {
            this.background.setInteractive({ useHandCursor: true });
        } else {
            this.background.disableInteractive();
        }
    }
}

export class BattlePopup extends Phaser.GameObjects.Container {
    private readonly config: BattlePopupConfig;
    private readonly panels: Record<BattlePopupSide, FighterPanel>;
    private readonly maxHp: Record<BattlePopupSide, number>;
    private readonly confirmButton: PopupButton;
    private readonly cancelButton: PopupButton;
    private readonly flash: Phaser.GameObjects.Rectangle;
    private popupState: PopupState = 'entering';
    private exchangeIndex = 0;

    constructor(scene: Phaser.Scene, config: BattlePopupConfig) {
        const camera = scene.cameras.main;
        super(scene, camera.centerX, camera.centerY);
        this.config = config;
        this.maxHp = { left: config.left.maxHp, right: config.right.maxHp };

        const backdrop = scene.add.rectangle(0, 0, camera.width, camera.height, COLORS.backdrop, 0.78)
            .setInteractive();
        const frame = scene.add.rectangle(0, 0, 700, 390, 0x0d1627, 1)
            .setStrokeStyle(3, COLORS.panelBorder, 0.9);
        const title = scene.add.text(0, -173, config.title ?? 'COMBAT FORECAST', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: COLORS.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const leftPanel = new FighterPanel(scene, -165, config.left, 'left');
        const rightPanel = new FighterPanel(scene, 165, config.right, 'right');
        this.panels = { left: leftPanel, right: rightPanel };

        const versus = scene.add.text(0, -10, 'VS', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '25px',
            color: '#ffd36a',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.confirmButton = new PopupButton(
            scene,
            -92,
            158,
            164,
            'CONFIRM  [ENTER]',
            () => this.confirm()
        );
        this.cancelButton = new PopupButton(
            scene,
            92,
            158,
            164,
            'CANCEL  [ESC]',
            () => this.cancel()
        );
        this.flash = scene.add.rectangle(0, 0, camera.width, camera.height, COLORS.flash, 0)
            .setVisible(false);

        this.add([
            backdrop,
            frame,
            title,
            leftPanel,
            rightPanel,
            versus,
            this.confirmButton,
            this.cancelButton,
            this.flash
        ]);

        scene.add.existing(this);
        this.setDepth(config.depth ?? 10_000);
        this.setScrollFactor(0);
        this.bindInput();
        this.playEntrance();
    }

    confirm(): void {
        if (this.popupState !== 'preview') {
            return;
        }
        this.popupState = 'playing';
        this.setButtonsEnabled(false);
        this.config.onConfirm?.();
        this.playNextExchange();
    }

    cancel(): void {
        if (this.popupState !== 'preview' && this.popupState !== 'entering') {
            return;
        }
        this.popupState = 'closing';
        this.config.onCancel?.();
        this.close(false);
    }

    override destroy(fromScene?: boolean): void {
        if (this.popupState === 'destroyed') {
            return;
        }
        this.unbindInput();
        this.popupState = 'destroyed';
        super.destroy(fromScene);
    }

    private bindInput(): void {
        const keyboard = this.scene.input.keyboard;
        keyboard?.on('keydown-ENTER', this.confirm, this);
        keyboard?.on('keydown-SPACE', this.confirm, this);
        keyboard?.on('keydown-ESC', this.cancel, this);
    }

    private unbindInput(): void {
        const keyboard = this.scene.input.keyboard;
        keyboard?.off('keydown-ENTER', this.confirm, this);
        keyboard?.off('keydown-SPACE', this.confirm, this);
        keyboard?.off('keydown-ESC', this.cancel, this);
    }

    private playEntrance(): void {
        this.setAlpha(0);
        this.setScale(0.9);
        this.y += 28;
        this.scene.tweens.add({
            targets: this,
            alpha: 1,
            scale: 1,
            y: this.y - 28,
            duration: 240,
            ease: 'Back.Out',
            onComplete: () => {
                if (this.popupState === 'entering') {
                    this.popupState = 'preview';
                }
            }
        });
    }

    private playNextExchange(): void {
        const exchange = this.config.exchanges[this.exchangeIndex];
        if (!exchange) {
            this.finishSequence();
            return;
        }

        const targetSide: BattlePopupSide = exchange.actor === 'left' ? 'right' : 'left';
        const actor = this.panels[exchange.actor].getPortrait();
        const targetPanel = this.panels[targetSide];
        const direction = exchange.actor === 'left' ? 1 : -1;

        this.scene.tweens.add({
            targets: actor,
            x: actor.x + direction * 34,
            duration: 120,
            ease: 'Quad.In',
            yoyo: true,
            hold: 70,
            onYoyo: () => this.playImpact(targetPanel, targetSide, exchange, direction),
            onComplete: () => {
                this.exchangeIndex += 1;
                this.scene.time.delayedCall(180, () => this.playNextExchange());
            }
        });
    }

    private playImpact(
        targetPanel: FighterPanel,
        targetSide: BattlePopupSide,
        exchange: BattlePopupExchange,
        direction: number
    ): void {
        if (!exchange.hit) {
            this.showOutcomeLabel(targetPanel, 'MISS', '#dbe7ff');
            return;
        }

        this.flash.setVisible(true).setAlpha(exchange.critical ? 0.75 : 0.4);
        this.scene.tweens.add({
            targets: this.flash,
            alpha: 0,
            duration: exchange.critical ? 180 : 110,
            onComplete: () => this.flash.setVisible(false)
        });
        this.scene.tweens.add({
            targets: targetPanel,
            x: targetPanel.x + direction * 20,
            duration: 55,
            yoyo: true,
            repeat: 2
        });

        targetPanel.updateHp(exchange.targetHpAfter, this.maxHp[targetSide]);
        this.showOutcomeLabel(
            targetPanel,
            exchange.critical ? `CRITICAL -${exchange.damage}` : `-${exchange.damage}`,
            exchange.critical ? '#ffd36a' : '#ffffff'
        );

        if (exchange.targetHpAfter <= 0) {
            this.scene.tweens.add({
                targets: targetPanel,
                alpha: 0,
                y: targetPanel.y + 35,
                delay: 220,
                duration: 300,
                ease: 'Quad.In'
            });
        }
    }

    private showOutcomeLabel(panel: FighterPanel, text: string, color: string): void {
        const label = this.scene.add.text(panel.x, -45, text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color,
            fontStyle: 'bold',
            stroke: '#111827',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.add(label);
        this.scene.tweens.add({
            targets: label,
            y: label.y - 42,
            alpha: 0,
            duration: 560,
            ease: 'Quad.Out',
            onComplete: () => label.destroy()
        });
    }

    private finishSequence(): void {
        this.popupState = 'closing';
        this.scene.time.delayedCall(300, () => this.close(true));
    }

    private close(completed: boolean): void {
        this.unbindInput();
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            scale: 0.94,
            duration: 180,
            ease: 'Quad.In',
            onComplete: () => {
                if (completed) {
                    this.config.onComplete?.();
                }
                this.destroy();
            }
        });
    }

    private setButtonsEnabled(enabled: boolean): void {
        this.confirmButton.setEnabled(enabled);
        this.cancelButton.setEnabled(enabled);
    }
}

export function showBattlePopup(scene: Phaser.Scene, config: BattlePopupConfig): BattlePopup {
    return new BattlePopup(scene, config);
}
