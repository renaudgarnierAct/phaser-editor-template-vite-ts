import type { AIBehavior, AIBehaviorId } from '../types.ts';
import { aggressiveBehavior } from './aggressive.ts';
import { defensiveBehavior } from './defensive.ts';
import { guardBehavior } from './guard.ts';
import { bossBehavior } from './boss.ts';

const registry = new Map<AIBehaviorId, AIBehavior>();

/** Registers (or overrides) a behavior implementation under its `id`. */
export function registerAIBehavior(behavior: AIBehavior): void {
    registry.set(behavior.id, behavior);
}

/** Looks up a registered behavior by id, or `undefined` if none matches. */
export function getAIBehavior(id: AIBehaviorId): AIBehavior | undefined {
    return registry.get(id);
}

/** All currently registered behavior ids. */
export function listAIBehaviors(): AIBehaviorId[] {
    return [...registry.keys()];
}

registerAIBehavior(aggressiveBehavior);
registerAIBehavior(defensiveBehavior);
registerAIBehavior(guardBehavior);
registerAIBehavior(bossBehavior);

export { aggressiveBehavior, defensiveBehavior, guardBehavior, bossBehavior };
