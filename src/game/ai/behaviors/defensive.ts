import { chooseIdleTileAwayFrom, nearestEnemy } from '../placement.ts';
import type { AIBehavior, AIContext, TargetEvaluation } from '../types.ts';

const DEFAULT_FLEE_HP_RATIO = 0.3;

function fleeThreshold(context: AIContext): number {
    return context.profile.fleeHpRatio ?? DEFAULT_FLEE_HP_RATIO;
}

/**
 * Prioritizes safe trades: favors low personal risk and terrain-backed
 * exchanges, and retreats from the nearest threat once its HP drops below
 * `fleeHpRatio` instead of pressing an attack.
 */
export const defensiveBehavior: AIBehavior = {
    id: 'defensive',

    scoreTarget(evaluation: TargetEvaluation): number {
        const { forecast } = evaluation;
        let score = forecast.expectedDamageToTarget - forecast.expectedDamageToSelf * 2;
        if (forecast.lethalToTarget && !forecast.lethalToSelf) {
            score += 60;
        }
        score -= forecast.selfDeathRisk * 100;
        if (!forecast.targetCanCounter) {
            score += 15;
        }
        return score;
    },

    chooseIdleTile(unit, _reachable, context: AIContext) {
        const enemy = nearestEnemy(unit, context);
        if (enemy === undefined) {
            return undefined;
        }
        const hpRatio = unit.stats.maxHp > 0 ? unit.stats.hp / unit.stats.maxHp : 1;
        return hpRatio < fleeThreshold(context) ? chooseIdleTileAwayFrom(unit, context, enemy) : undefined;
    },

    shouldEngage(evaluation: TargetEvaluation, context: AIContext): boolean {
        const hpRatio = evaluation.unit.stats.maxHp > 0 ? evaluation.unit.stats.hp / evaluation.unit.stats.maxHp : 1;
        if (hpRatio < fleeThreshold(context) && !evaluation.forecast.lethalToTarget) {
            return false;
        }
        return evaluation.forecast.selfDeathRisk < 0.35 || (evaluation.forecast.lethalToTarget && evaluation.forecast.selfDeathRisk < 0.6);
    }
};
