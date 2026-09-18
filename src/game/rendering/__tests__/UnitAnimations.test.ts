import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    UnitAnimator,
    type UnitAnimationTarget,
    type UnitTween,
    type UnitTweenConfig,
    type UnitTweenDriver
} from '../UnitAnimations.ts';

class FakeTweenDriver implements UnitTweenDriver {
    readonly pending: Array<{ config: UnitTweenConfig; tween: FakeTween }> = [];

    add(config: UnitTweenConfig): UnitTween {
        const tween = new FakeTween();
        this.pending.push({ config, tween });
        return tween;
    }

    completeNext(): UnitTweenConfig {
        const pending = this.pending.shift();
        assert.ok(pending, 'expected a pending tween');
        applyTweenValues(pending.config);
        pending.config.onComplete?.();
        return pending.config;
    }
}

class FakeTween implements UnitTween {
    stopped = false;
    removed = false;

    stop(): void {
        this.stopped = true;
    }

    remove(): void {
        this.removed = true;
    }
}

function makeTarget(): UnitAnimationTarget {
    return { x: 10, y: 20, alpha: 1, scaleX: 1, scaleY: 1, visible: true };
}

function applyTweenValues(config: UnitTweenConfig): void {
    for (const property of ['x', 'y', 'alpha', 'scaleX', 'scaleY'] as const) {
        const value = config[property];
        if (value !== undefined) {
            config.targets[property] = value;
        }
    }
}

test('move animates every path cell in order with the configured easing', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();

    const animation = animator.move(target, [{ x: 42, y: 20 }, { x: 42, y: 52 }], {
        durationPerCell: 125,
        ease: 'Linear'
    });

    assert.equal(driver.pending.length, 1);
    assert.deepEqual(
        { x: driver.pending[0]?.config.x, y: driver.pending[0]?.config.y },
        { x: 42, y: 20 }
    );
    assert.equal(driver.completeNext().duration, 125);
    assert.deepEqual(
        { x: driver.pending[0]?.config.x, y: driver.pending[0]?.config.y },
        { x: 42, y: 52 }
    );
    assert.equal(driver.completeNext().ease, 'Linear');
    assert.equal(await animation.finished, 'completed');
    assert.deepEqual({ x: target.x, y: target.y }, { x: 42, y: 52 });
});

test('impact returns to the original position and opacity', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();
    const animation = animator.impact(target, { distance: 8, direction: -1 });

    assert.equal(driver.pending[0]?.config.x, 2);
    driver.completeNext();
    assert.equal(driver.pending[0]?.config.x, 14);
    driver.completeNext();
    driver.completeNext();

    assert.equal(await animation.finished, 'completed');
    assert.deepEqual({ x: target.x, alpha: target.alpha }, { x: 10, alpha: 1 });
});

test('death fades, hides, and optionally destroys the target', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();
    let destroyed = false;
    target.destroy = () => {
        destroyed = true;
    };

    const animation = animator.die(target, { destroyOnComplete: true });
    driver.completeNext();

    assert.equal(await animation.finished, 'completed');
    assert.equal(target.alpha, 0);
    assert.equal(target.visible, false);
    assert.equal(destroyed, true);
});

test('promotion restores the target transform after its two phases', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();
    const animation = animator.promote(target, { peakScale: 1.5 });

    assert.equal(driver.pending[0]?.config.scaleX, 1.5);
    driver.completeNext();
    assert.equal(driver.pending[0]?.config.scaleX, 1);
    driver.completeNext();

    assert.equal(await animation.finished, 'completed');
    assert.deepEqual(
        { alpha: target.alpha, scaleX: target.scaleX, scaleY: target.scaleY },
        { alpha: 1, scaleX: 1, scaleY: 1 }
    );
});

test('cancelling restores the initial state and stops the active tween', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();
    const animation = animator.impact(target);
    const tween = driver.pending[0]?.tween;

    target.x = 13;
    target.alpha = 0.65;
    animation.cancel();

    assert.equal(await animation.finished, 'cancelled');
    assert.equal(tween?.stopped, true);
    assert.equal(tween?.removed, true);
    assert.deepEqual({ x: target.x, alpha: target.alpha }, { x: 10, alpha: 1 });
});

test('starting another animation cancels the previous one on the same target', async () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);
    const target = makeTarget();
    const movement = animator.move(target, [{ x: 42, y: 20 }]);

    const promotion = animator.promote(target);

    assert.equal(await movement.finished, 'cancelled');
    promotion.cancel();
    assert.equal(await promotion.finished, 'cancelled');
});

test('invalid timing options fail before a tween is created', () => {
    const driver = new FakeTweenDriver();
    const animator = new UnitAnimator(driver);

    assert.throws(() => animator.move(makeTarget(), [], { durationPerCell: 0 }), RangeError);
    assert.equal(driver.pending.length, 0);
});
