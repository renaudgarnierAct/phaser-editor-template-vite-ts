import * as Phaser from 'phaser';
import { createWorldSaveSystem } from '../save/WorldSaveSystem';
import { createInitialProgress, isNodeUnlocked } from '../world/WorldMapSystem';
import { createChapterLaunchData } from '../world/chapterLaunch';
import { loadWorldMap } from '../world/loadWorldMap';
import type { WorldMapData, WorldNodeData, WorldProgressState } from '../world/types';

const WORLD_MAP_PATH = '/data/world-map.json';
const NORMAL_SAVE_SLOT = 'campaign-1';
const MAP_BOUNDS = new Phaser.Geom.Rectangle(130, 180, 764, 360);

export default class WorldMap extends Phaser.Scene {
    private map?: WorldMapData;
    private progress?: WorldProgressState;
    private selectedNode?: WorldNodeData;
    private statusText!: Phaser.GameObjects.Text;
    private selectionText!: Phaser.GameObjects.Text;
    private readonly saveSystem = createWorldSaveSystem();

    constructor() {
        super('WorldMap');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x101926);
        this.add.text(512, 36, 'CARTE DU MONDE', {
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '32px',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(512, 80, 'Choisissez un chapitre déverrouillé', {
            color: '#aebed0',
            fontFamily: 'Arial',
            fontSize: '17px'
        }).setOrigin(0.5);

        this.selectionText = this.add.text(512, 574, 'Chargement...', {
            align: 'center',
            color: '#f8e7bd',
            fontFamily: 'Arial',
            fontSize: '18px',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.statusText = this.add.text(512, 714, '', {
            align: 'center',
            color: '#aebed0',
            fontFamily: 'Arial',
            fontSize: '14px'
        }).setOrigin(0.5);

        this.createButton(282, 644, 'Sauvegarde rapide', () => this.quickSave());
        this.createButton(512, 644, 'Sauvegarde normale', () => this.normalSave());
        this.createButton(742, 644, 'Lancer le chapitre', () => this.launchSelectedChapter(), 0xd7a84a);

        void this.loadAndRender();
    }

    private async loadAndRender(): Promise<void> {
        try {
            this.map = await loadWorldMap(WORLD_MAP_PATH);
            this.progress = createInitialProgress(this.map);
            this.selectedNode = this.map.nodes.find((node) => node.id === this.progress?.currentNodeId);
            this.renderConnections();
            this.renderNodes();
            this.updateSelection();
            this.setStatus(`${this.map.name} chargée.`);
        } catch (error) {
            this.selectionText.setText('Impossible de charger la carte du monde.');
            this.setStatus('Vérifiez les données de public/data/world-map.json.', true);
            console.error('World map loading failed.', error);
        }
    }

    private renderConnections(): void {
        if (this.map === undefined) {
            return;
        }

        const rendered = new Set<string>();
        for (const node of this.map.nodes) {
            for (const connectedId of node.connections) {
                const connected = this.map.nodes.find((candidate) => candidate.id === connectedId);
                if (connected === undefined) {
                    continue;
                }

                const edgeId = [node.id, connected.id].sort().join('|');
                if (rendered.has(edgeId)) {
                    continue;
                }
                rendered.add(edgeId);

                const from = this.nodePosition(node);
                const to = this.nodePosition(connected);
                this.add.line(0, 0, from.x, from.y, to.x, to.y, 0x60738a, 0.8)
                    .setOrigin(0)
                    .setLineWidth(4);
            }
        }
    }

    private renderNodes(): void {
        if (this.map === undefined || this.progress === undefined) {
            return;
        }

        for (const node of this.map.nodes) {
            const position = this.nodePosition(node);
            const unlocked = isNodeUnlocked(node, this.progress);
            const isCurrent = node.id === this.progress.currentNodeId;
            const fillColor = unlocked ? (isCurrent ? 0xd7a84a : 0x4f83a6) : 0x34404d;
            const borderColor = unlocked ? 0xf8e7bd : 0x66717d;

            const marker = this.add.circle(position.x, position.y, isCurrent ? 28 : 24, fillColor)
                .setStrokeStyle(4, borderColor)
                .setInteractive({ useHandCursor: unlocked });
            const label = this.add.text(position.x, position.y + 42, node.name, {
                align: 'center',
                color: unlocked ? '#ffffff' : '#788594',
                fontFamily: 'Arial',
                fontSize: '14px',
                fontStyle: unlocked ? 'bold' : 'normal',
                wordWrap: { width: 210 }
            }).setOrigin(0.5, 0);

            marker.on('pointerdown', () => this.selectNode(node, unlocked));
            label.setInteractive({ useHandCursor: unlocked });
            label.on('pointerdown', () => this.selectNode(node, unlocked));

            if (!unlocked) {
                this.add.text(position.x, position.y - 1, '×', {
                    color: '#aeb6bf',
                    fontFamily: 'Arial',
                    fontSize: '24px',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
            }
        }
    }

    private nodePosition(node: WorldNodeData): Phaser.Math.Vector2 {
        if (this.map === undefined) {
            return new Phaser.Math.Vector2(MAP_BOUNDS.centerX, MAP_BOUNDS.centerY);
        }

        const xs = this.map.nodes.map((candidate) => candidate.x);
        const ys = this.map.nodes.map((candidate) => candidate.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const xRatio = maxX === minX ? 0.5 : (node.x - minX) / (maxX - minX);
        const yRatio = maxY === minY ? 0.5 : (node.y - minY) / (maxY - minY);
        return new Phaser.Math.Vector2(
            MAP_BOUNDS.left + xRatio * MAP_BOUNDS.width,
            MAP_BOUNDS.top + yRatio * MAP_BOUNDS.height
        );
    }

    private selectNode(node: WorldNodeData, unlocked: boolean): void {
        if (!unlocked) {
            this.setStatus(`${node.name} est encore verrouillé.`, true);
            return;
        }

        this.selectedNode = node;
        this.updateSelection();
        this.setStatus(`Chapitre sélectionné : ${node.chapterId}`);
    }

    private updateSelection(): void {
        this.selectionText.setText(
            this.selectedNode === undefined
                ? 'Aucun chapitre disponible.'
                : `${this.selectedNode.name}\n${this.selectedNode.chapterId}`
        );
    }

    private quickSave(): void {
        this.saveProgress('Sauvegarde rapide effectuée.', () => this.saveSystem.quickSave(this.requireProgress()));
    }

    private normalSave(): void {
        this.saveProgress(
            'Sauvegarde normale effectuée dans le slot Campagne 1.',
            () => this.saveSystem.save(NORMAL_SAVE_SLOT, this.requireProgress())
        );
    }

    private saveProgress(successMessage: string, save: () => void): void {
        try {
            save();
            this.setStatus(successMessage);
        } catch (error) {
            this.setStatus('La sauvegarde a échoué.', true);
            console.error('World progress save failed.', error);
        }
    }

    private requireProgress(): WorldProgressState {
        if (this.progress === undefined) {
            throw new Error('World progress is not loaded yet.');
        }
        return this.progress;
    }

    private launchSelectedChapter(): void {
        if (this.selectedNode === undefined) {
            this.setStatus('Sélectionnez d’abord un chapitre déverrouillé.', true);
            return;
        }

        this.scene.start('Game', createChapterLaunchData(this.selectedNode));
    }

    private createButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        backgroundColor = 0x38546d
    ): Phaser.GameObjects.Text {
        const button = this.add.text(x, y, label, {
            backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}`,
            color: '#ffffff',
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        button.on('pointerdown', onClick);
        button.on('pointerover', () => button.setAlpha(0.82));
        button.on('pointerout', () => button.setAlpha(1));
        return button;
    }

    private setStatus(message: string, isError = false): void {
        this.statusText.setColor(isError ? '#ff9b9b' : '#aebed0');
        this.statusText.setText(message);
    }
}
