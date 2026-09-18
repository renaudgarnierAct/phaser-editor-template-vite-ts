import { distanceTo, reachableTiles } from '../range.ts';
import { chooseIdleTileTowards, closestTileTo } from '../placement.ts';
import type { AIBehavior, AIContext, GridPointLike, TargetEvaluation } from '../types.ts';

const DEFAULT_GUARD_RADIUS = 3;
const DEFAULT_AGGRO_RANGE = 3;

function guardPoint(context: AIContext, unit: { x: number; y: number }): GridPointLike {
    return context.profile.guardPoint ?? unit;
}

function guardRadius(context: AIContext): number {
    return context.profile.guardRadius ?? DEFAULT_GUARD_RADIUS;
}

function aggroRange(context: AIContext): number {
    return context.profile.aggroRange ?? DEFAULT_AGGRO_RANGE;
}

/**
 * Stays near its `guardPoint` and ignores enemies outside `aggroRange`. Once
 * provoked it fights like `aggressive`, but always prefers a destination
 * tile within `guardRadius` of its post so it drifts back home afterwards.
 */
export const guardBehavior: AIBehavior = {
    id: 'guard',

    scoreTarget(evaluation: TargetEvaluation): number {
        const { forecast } = evaluation;
        let score = forecast.expectedDamageToTarget * 2 - forecast.expectedDamageToSelf * 0.75;
        if (forecast.lethalToTarget) {
            score += 80;
        }
        score -= forecast.selfDeathRisk * 60;
        return score;
    },

    chooseIdleTile(unit, reachable, context: AIContext) {
        const post = guardPoint(context, unit);
        const withinPatrol = reachableTiles(unit, context.board).filter((tile) => distanceTo(tile, post) <= guardRadius(context));
        const pool = withinPatrol.length > 0 ? withinPatrol : reachable;
        return closestTileTo(pool, post) ?? chooseIdleTileTowards(unit, context, post);
    },

    shouldEngage(evaluation: TargetEvaluation, context: AIContext): boolean {
        const post = guardPoint(context, evaluation.unit);
        const targetDistanceFromPost = distanceTo(evaluation.target, post);
        if (targetDistanceFromPost > aggroRange(context)) {
            return false;
        }
        return evaluation.forecast.lethalToTarget || evaluation.forecast.selfDeathRisk < 0.7;
    }
};
