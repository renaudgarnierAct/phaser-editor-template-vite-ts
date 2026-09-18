import type { UnitData } from '../data/types.ts';
import { getAIBehavior } from './behaviors/index.ts';
import { reachableTiles } from './range.ts';
import { chooseTarget } from './targeting.ts';
import type { AIBoardQuery, AIContext, AIDecision, AIProfile } from './types.ts';

/**
 * Decides a single unit's action for the current turn: evaluate every
 * reachable attack, defer to the behavior's engagement rules, and fall back
 * to a behavior-chosen idle move (or a full wait) otherwise.
 */
export function decideAction(unit: UnitData, profile: AIProfile, board: AIBoardQuery, rng?: () => number): AIDecision {
    const behavior = getAIBehavior(profile.behavior);
    if (behavior === undefined) {
        throw new Error(`Unknown AI behavior: ${profile.behavior}`);
    }

    const context: AIContext = { board, profile, rng };
    const bestTarget = chooseTarget(unit, context, behavior);

    if (bestTarget !== undefined && behavior.shouldEngage(bestTarget, context)) {
        return {
            unit,
            action: 'attack',
            moveTo: bestTarget.attackFrom,
            target: bestTarget.target,
            evaluation: bestTarget
        };
    }

    const idleTile = behavior.chooseIdleTile(unit, reachableTiles(unit, board), context);
    if (idleTile !== undefined && (idleTile.x !== unit.x || idleTile.y !== unit.y)) {
        return { unit, action: 'move', moveTo: idleTile };
    }

    return { unit, action: 'wait' };
}
