import * as Phaser from 'phaser';
import {
    buildDialoguePages,
    getSelectedChoice,
    moveChoiceSelection,
    type DialogueChoice,
    type DialogueEntry,
    type DialoguePage
} from './dialogueLogic.ts';

export interface DialogueBoxCallbacks {
    onPageStart?: (page: DialoguePage, index: number) => void;
    onAdvance?: (page: DialoguePage, index: number) => void;
    onChoice?: (choice: DialogueChoice, page: DialoguePage, index: number) => void;
    onComplete?: () => void;
    onCancel?: () => void;
}

export interface DialogueBoxConfig extends DialogueBoxCallbacks {
    entries: readonly DialogueEntry[];
    charactersPerPage?: number;
    characterDelay?: number;
    width?: number;
    height?: number;
    margin?: number;
    depth?: number;
    allowCancel?: boolean;
}

const COLORS = {
    panel: 0x111b2d,
    border: 0xd7c791,
    speaker: '#ffd36a',
    text: '#f6f2df',
    muted: '#aab8d4',
    choice: 0x263b60,
    choiceSelected: 0x496eaa
} as const;

export class DialogueBox extends Phaser.GameObjects.Container {
    private readonly config: DialogueBoxConfig;
    private readonly pages: readonly DialoguePage[];
    private readonly speakerText: Phaser.GameObjects.Text;
    private readonly bodyText: Phaser.GameObjects.Text;
    private readonly pageIndicator: Phaser.GameObjects.Text;
    private readonly promptText: Phaser.GameObjects.Text;
    private readonly choiceContainer: Phaser.GameObjects.Container;
    private typingTimer?: Phaser.Time.TimerEvent;
    private choiceButtons: Phaser.GameObjects.Rectangle[] = [];
    private pageIndex = 0;
    private visibleCharacters = 0;
    private selectedChoiceIndex = 0;
    private closed = false;

    constructor(scene: Phaser.Scene, config: DialogueBoxConfig) {
        const camera = scene.cameras.main;
        const width = config.width ?? Math.min(760, camera.width - 32);
        const height = config.height ?? 230;
        const margin = config.margin ?? 24;
        super(scene, camera.centerX, camera.height - margin - height / 2);

        if (config.entries.length === 0) {
            throw new Error('DialogueBox requires at least one dialogue entry');
        }

        this.config = config;
        this.pages = buildDialoguePages(config.entries, config.charactersPerPage);

        const panel = scene.add.rectangle(0, 0, width, height, COLORS.panel, 0.96)
            .setStrokeStyle(3, COLORS.border);
        this.speakerText = scene.add.text(-width / 2 + 24, -height / 2 + 18, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '21px',
            color: COLORS.speaker,
            fontStyle: 'bold'
        });
        this.bodyText = scene.add.text(-width / 2 + 24, -height / 2 + 55, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '19px',
            color: COLORS.text,
            lineSpacing: 6,
            wordWrap: { width: width - 48 }
        });
        this.pageIndicator = scene.add.text(width / 2 - 24, height / 2 - 22, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: COLORS.muted
        }).setOrigin(1, 0.5);
        this.promptText = scene.add.text(-width / 2 + 24, height / 2 - 22, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: COLORS.muted
        }).setOrigin(0, 0.5);
        this.choiceContainer = scene.add.container(0, 28);

        panel.setInteractive({ useHandCursor: true }).on('pointerup', () => this.advance());
        this.add([
            panel,
            this.speakerText,
            this.bodyText,
            this.choiceContainer,
            this.promptText,
            this.pageIndicator
        ]);

        scene.add.existing(this);
        this.setDepth(config.depth ?? 10_000);
        this.setScrollFactor(0);
        this.bindInput();
        this.showCurrentPage();
    }

    advance(): void {
        if (this.closed) {
            return;
        }

        const page = this.pages[this.pageIndex];
        if (!page) {
            return;
        }

        if (this.visibleCharacters < page.text.length) {
            this.finishTyping();
            return;
        }

        if (page.choices.length > 0) {
            this.choose();
            return;
        }

        this.config.onAdvance?.(page, this.pageIndex);
        if (this.pageIndex === this.pages.length - 1) {
            this.complete();
            return;
        }

        this.pageIndex += 1;
        this.showCurrentPage();
    }

    cancel(): void {
        if (!this.config.allowCancel || this.closed) {
            return;
        }
        this.closed = true;
        this.config.onCancel?.();
        this.destroy();
    }

    override destroy(fromScene?: boolean): void {
        if (!this.closed) {
            this.closed = true;
        }
        this.typingTimer?.remove(false);
        this.unbindInput();
        super.destroy(fromScene);
    }

    private showCurrentPage(): void {
        const page = this.pages[this.pageIndex];
        if (!page) {
            this.complete();
            return;
        }

        this.typingTimer?.remove(false);
        this.clearChoices();
        this.selectedChoiceIndex = 0;
        this.visibleCharacters = 0;
        this.speakerText.setText(page.speaker ?? '');
        this.bodyText.setText('');
        this.pageIndicator.setText(`${this.pageIndex + 1} / ${this.pages.length}`);
        this.promptText.setText('');
        this.config.onPageStart?.(page, this.pageIndex);

        const delay = Math.max(0, this.config.characterDelay ?? 24);
        if (delay === 0 || page.text.length === 0) {
            this.finishTyping();
            return;
        }

        this.typingTimer = this.scene.time.addEvent({
            delay,
            repeat: page.text.length - 1,
            callback: () => {
                this.visibleCharacters += 1;
                this.bodyText.setText(page.text.slice(0, this.visibleCharacters));
                if (this.visibleCharacters >= page.text.length) {
                    this.onTypingComplete(page);
                }
            }
        });
    }

    private finishTyping(): void {
        const page = this.pages[this.pageIndex];
        if (!page) {
            return;
        }
        this.typingTimer?.remove(false);
        this.typingTimer = undefined;
        this.visibleCharacters = page.text.length;
        this.bodyText.setText(page.text);
        this.onTypingComplete(page);
    }

    private onTypingComplete(page: DialoguePage): void {
        this.typingTimer = undefined;
        if (page.choices.length > 0) {
            this.renderChoices(page.choices);
            this.promptText.setText('UP/DOWN select  ENTER confirm');
        } else {
            this.promptText.setText(this.pageIndex < this.pages.length - 1 ? 'ENTER continue' : 'ENTER close');
        }
    }

    private renderChoices(choices: readonly DialogueChoice[]): void {
        this.clearChoices();
        const width = (this.config.width ?? Math.min(760, this.scene.cameras.main.width - 32)) - 80;
        const startY = -((choices.length - 1) * 38) / 2;

        choices.forEach((choice, index) => {
            const background = this.scene.add.rectangle(0, startY + index * 38, width, 32, COLORS.choice)
                .setStrokeStyle(1, COLORS.border)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    this.selectedChoiceIndex = index;
                    this.refreshChoiceSelection();
                })
                .on('pointerup', () => {
                    this.selectedChoiceIndex = index;
                    this.choose();
                });
            const label = this.scene.add.text(-width / 2 + 12, startY + index * 38, choice.label, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                color: COLORS.text
            }).setOrigin(0, 0.5);
            this.choiceButtons.push(background);
            this.choiceContainer.add([background, label]);
        });
        this.refreshChoiceSelection();
    }

    private moveChoice(direction: -1 | 1): void {
        const page = this.pages[this.pageIndex];
        if (!page || this.visibleCharacters < page.text.length || page.choices.length === 0) {
            return;
        }
        this.selectedChoiceIndex = moveChoiceSelection(
            this.selectedChoiceIndex,
            direction,
            page.choices.length
        );
        this.refreshChoiceSelection();
    }

    private choose(): void {
        const page = this.pages[this.pageIndex];
        if (!page || this.visibleCharacters < page.text.length) {
            return;
        }
        const choice = getSelectedChoice(page.choices, this.selectedChoiceIndex);
        if (!choice) {
            return;
        }

        this.config.onChoice?.(choice, page, this.pageIndex);
        this.config.onAdvance?.(page, this.pageIndex);
        if (this.pageIndex === this.pages.length - 1) {
            this.complete();
            return;
        }

        this.pageIndex += 1;
        this.showCurrentPage();
    }

    private complete(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.config.onComplete?.();
        this.destroy();
    }

    private clearChoices(): void {
        this.choiceButtons = [];
        this.choiceContainer.removeAll(true);
    }

    private refreshChoiceSelection(): void {
        this.choiceButtons.forEach((button, index) => {
            button.setFillStyle(index === this.selectedChoiceIndex ? COLORS.choiceSelected : COLORS.choice);
        });
    }

    private bindInput(): void {
        const keyboard = this.scene.input.keyboard;
        keyboard?.on('keydown-ENTER', this.advance, this);
        keyboard?.on('keydown-SPACE', this.advance, this);
        keyboard?.on('keydown-UP', this.selectPreviousChoice, this);
        keyboard?.on('keydown-DOWN', this.selectNextChoice, this);
        keyboard?.on('keydown-ESC', this.cancel, this);
    }

    private unbindInput(): void {
        const keyboard = this.scene.input.keyboard;
        keyboard?.off('keydown-ENTER', this.advance, this);
        keyboard?.off('keydown-SPACE', this.advance, this);
        keyboard?.off('keydown-UP', this.selectPreviousChoice, this);
        keyboard?.off('keydown-DOWN', this.selectNextChoice, this);
        keyboard?.off('keydown-ESC', this.cancel, this);
    }

    private selectPreviousChoice(): void {
        this.moveChoice(-1);
    }

    private selectNextChoice(): void {
        this.moveChoice(1);
    }
}

export function showDialogueBox(scene: Phaser.Scene, config: DialogueBoxConfig): DialogueBox {
    return new DialogueBox(scene, config);
}
