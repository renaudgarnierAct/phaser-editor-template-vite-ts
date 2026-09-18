import { chooseIdleTileTowards, nearestEnemy } from '../placement.ts';
import type { AIBehavior, AIContext, TargetEvaluation } from '../types.ts';

/**
 * Rushes the nearest reachable enemy and takes almost any fight, favoring raw
 * expected damage dealt and finishing blows over self-preservation.
 */
export const aggressiveBehavior: AIBehavior = {
    id: 'aggressive',

    scoreTarget(evaluation: TargetEvaluation): number {
        const { forecast } = evaluation;
        let score = forecast.expectedDamageToTarget * 2 - forecast.expectedDamageToSelf * 0.5;
        if (forecast.lethalToTarget) {
            score += 100;
        }
        score -= forecast.selfDeathRisk * 40;
        return score;
    },

    chooseIdleTile(unit, _reachable, context: AIContext) {
        const enemy = nearestEnemy(unit, context);
        return enemy === undefined ? undefined : chooseIdleTileTowards(unit, context, enemy);
    },

    shouldEngage(evaluation: TargetEvaluation): boolean {
        // Will happily trade even at significant personal risk, but never a
        // near-certain suicide unless it secures the kill.
        return evaluation.forecast.lethalToTarget || evaluation.forecast.selfDeathRisk < 0.85;
    }
};
