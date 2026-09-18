import type * as Phaser from 'phaser';

export interface UnitAnimationTarget {
    x: number;
    y: number;
    alpha: number;
    scaleX: number;
    scaleY: number;
    visible?: boolean;
    setVisible?(visible: boolean): unknown;
    destroy?(): void;
}

export interface UnitAnimationPoint {
    x: number;
    y: number;
}

export type UnitAnimationStatus = 'completed' | 'cancelled';

export interface UnitAnimationHandle {
    readonly finished: Promise<UnitAnimationStatus>;
    readonly isRunning: boolean;
    cancel(): void;
}

export interface UnitMoveAnimationOptions {
    durationPerCell?: number;
    ease?: string;
}

export interface UnitImpactAnimationOptions {
    distance?: number;
    duration?: number;
    ease?: string;
    direction?: -1 | 1;
}

export interface UnitDeathAnimationOptions {
    duration?: number;
    ease?: string;
    endScale?: number;
    destroyOnComplete?: boolean;
}

export interface UnitPromotionAnimationOptions {
    duration?: number;
    ease?: string;
    peakScale?: number;
}

export interface UnitTween {
    stop(): void;
    remove?(): void;
}

export interface UnitTweenConfig {
    targets: UnitAnimationTarget;
    x?: number;
    y?: number;
    alpha?: number;
    scaleX?: number;
    scaleY?: number;
    duration: number;
    ease: string;
    onComplete?: () => void;
}

export interface UnitTweenDriver {
    add(config: UnitTweenConfig): UnitTween;
}

interface TargetSnapshot {
    x: number;
    y: number;
    alpha: number;
    scaleX: number;
    scaleY: number;
    visible: boolean | undefined;
}

type TweenStep = Omit<UnitTweenConfig, 'targets' | 'onComplete'>;

const DEFAULT_EASE = 'Sine.InOut';

class SequenceHandle implements UnitAnimationHandle {
    private readonly driver: UnitTweenDriver;
    private readonly target: UnitAnimationTarget;
    private readonly steps: readonly TweenStep[];
    private readonly onComplete: () => void;
    private readonly onCancel: () => void;
    private activeTween?: UnitTween;
    private nextStep = 0;
    private status?: UnitAnimationStatus;
    private readonly resolveFinished: (status: UnitAnimationStatus) => void;

    readonly finished: Promise<UnitAnimationStatus>;

    constructor(
        driver: UnitTweenDriver,
        target: UnitAnimationTarget,
        steps: readonly TweenStep[],
        onComplete: () => void,
        onCancel: () => void
    ) {
        this.driver = driver;
        this.target = target;
        this.steps = steps;
        this.onComplete = onComplete;
        this.onCancel = onCancel;
        let resolveFinished!: (status: UnitAnimationStatus) => void;
        this.finished = new Promise((resolve) => {
            resolveFinished = resolve;
        });
        this.resolveFinished = resolveFinished;
        this.runNextStep();
    }

    get isRunning(): boolean {
        return this.status === undefined;
    }

    cancel(): void {
        if (!this.isRunning) {
            return;
        }

        this.status = 'cancelled';
        this.activeTween?.stop();
        this.activeTween?.remove?.();
        this.activeTween = undefined;
        this.onCancel();
        this.resolveFinished('cancelled');
    }

    private runNextStep(): void {
        if (!this.isRunning) {
            return;
        }

        const step = this.steps[this.nextStep];
        if (step === undefined) {
            this.status = 'completed';
            this.onComplete();
            this.resolveFinished('completed');
            return;
        }

        this.nextStep += 1;
        this.activeTween = this.driver.add({
            ...step,
            targets: this.target,
            onComplete: () => {
                this.activeTween = undefined;
                this.runNextStep();
            }
        });
    }
}

export class UnitAnimator {
    private readonly driver: UnitTweenDriver;
    private readonly activeByTarget = new WeakMap<UnitAnimationTarget, UnitAnimationHandle>();
    private readonly activeHandles = new Set<UnitAnimationHandle>();

    constructor(driver: UnitTweenDriver) {
        this.driver = driver;
    }

    move(
        target: UnitAnimationTarget,
        path: readonly UnitAnimationPoint[],
        options: UnitMoveAnimationOptions = {}
    ): UnitAnimationHandle {
        const duration = positive(options.durationPerCell, 160, 'durationPerCell');
        const ease = options.ease ?? DEFAULT_EASE;
        const snapshot = takeSnapshot(target);
        const steps = path.map(({ x, y }) => ({ x, y, duration, ease }));

        return this.start(target, steps, () => undefined, () => restoreSnapshot(target, snapshot));
    }

    impact(
        target: UnitAnimationTarget,
        options: UnitImpactAnimationOptions = {}
    ): UnitAnimationHandle {
        const distance = positive(options.distance, 6, 'distance');
        const duration = positive(options.duration, 70, 'duration');
        const direction = options.direction ?? 1;
        const ease = options.ease ?? 'Quad.Out';
        const snapshot = takeSnapshot(target);
        const offset = distance * direction;
        const steps: TweenStep[] = [
            { x: snapshot.x + offset, alpha: 0.65, duration, ease },
            { x: snapshot.x - offset * 0.5, alpha: 1, duration, ease },
            { x: snapshot.x, alpha: snapshot.alpha, duration, ease }
        ];
        const restore = (): void => restoreSnapshot(target, snapshot);

        return this.start(target, steps, restore, restore);
    }

    die(
        target: UnitAnimationTarget,
        options: UnitDeathAnimationOptions = {}
    ): UnitAnimationHandle {
        const duration = positive(options.duration, 420, 'duration');
        const endScale = positive(options.endScale, 0.75, 'endScale');
        const snapshot = takeSnapshot(target);
        const steps: TweenStep[] = [{
            alpha: 0,
            scaleX: snapshot.scaleX * endScale,
            scaleY: snapshot.scaleY * endScale,
            duration,
            ease: options.ease ?? 'Quad.In'
        }];

        return this.start(
            target,
            steps,
            () => {
                setVisible(target, false);
                if (options.destroyOnComplete === true) {
                    target.destroy?.();
                }
            },
            () => restoreSnapshot(target, snapshot)
        );
    }

    promote(
        target: UnitAnimationTarget,
        options: UnitPromotionAnimationOptions = {}
    ): UnitAnimationHandle {
        const duration = positive(options.duration, 240, 'duration');
        const peakScale = positive(options.peakScale, 1.25, 'peakScale');
        const ease = options.ease ?? DEFAULT_EASE;
        const snapshot = takeSnapshot(target);
        const steps: TweenStep[] = [
            {
                alpha: 0.35,
                scaleX: snapshot.scaleX * peakScale,
                scaleY: snapshot.scaleY * peakScale,
                duration,
                ease
            },
            {
                alpha: snapshot.alpha,
                scaleX: snapshot.scaleX,
                scaleY: snapshot.scaleY,
                duration,
                ease
            }
        ];
        const restore = (): void => restoreSnapshot(target, snapshot);

        return this.start(target, steps, restore, restore);
    }

    cancel(target: UnitAnimationTarget): void {
        this.activeByTarget.get(target)?.cancel();
    }

    destroy(): void {
        for (const handle of [...this.activeHandles]) {
            handle.cancel();
        }
    }

    private start(
        target: UnitAnimationTarget,
        steps: readonly TweenStep[],
        onComplete: () => void,
        onCancel: () => void
    ): UnitAnimationHandle {
        this.cancel(target);
        const handle = new SequenceHandle(this.driver, target, steps, onComplete, onCancel);
        this.activeByTarget.set(target, handle);
        this.activeHandles.add(handle);
        void handle.finished.then(() => {
            this.activeHandles.delete(handle);
            if (this.activeByTarget.get(target) === handle) {
                this.activeByTarget.delete(target);
            }
        });
        return handle;
    }
}

export function createPhaserUnitAnimator(scene: Phaser.Scene): UnitAnimator {
    return new UnitAnimator({
        add(config): UnitTween {
            return scene.tweens.add(config as Phaser.Types.Tweens.TweenBuilderConfig);
        }
    });
}

function positive(value: number | undefined, fallback: number, name: string): number {
    const resolved = value ?? fallback;
    if (!Number.isFinite(resolved) || resolved <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
    }
    return resolved;
}

function takeSnapshot(target: UnitAnimationTarget): TargetSnapshot {
    return {
        x: target.x,
        y: target.y,
        alpha: target.alpha,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        visible: target.visible
    };
}

function restoreSnapshot(target: UnitAnimationTarget, snapshot: TargetSnapshot): void {
    target.x = snapshot.x;
    target.y = snapshot.y;
    target.alpha = snapshot.alpha;
    target.scaleX = snapshot.scaleX;
    target.scaleY = snapshot.scaleY;
    if (snapshot.visible !== undefined) {
        setVisible(target, snapshot.visible);
    }
}

function setVisible(target: UnitAnimationTarget, visible: boolean): void {
    if (target.setVisible !== undefined) {
        target.setVisible(visible);
    } else {
        target.visible = visible;
    }
}
