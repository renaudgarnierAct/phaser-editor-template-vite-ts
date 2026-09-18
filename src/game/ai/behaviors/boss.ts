import { chooseIdleTileTowards, nearestEnemy } from '../placement.ts';
import type { AIBehavior, AIContext, TargetEvaluation } from '../types.ts';

const DEFAULT_ENRAGE_HP_RATIO = 0.5;

function enrageHpRatio(context: AIContext): number {
    return context.profile.params?.enrageHpRatio ?? DEFAULT_ENRAGE_HP_RATIO;
}

function isEnraged(evaluation: TargetEvaluation, context: AIContext): boolean {
    const hpRatio = evaluation.unit.stats.maxHp > 0 ? evaluation.unit.stats.hp / evaluation.unit.stats.maxHp : 1;
    return hpRatio <= enrageHpRatio(context);
}

/**
 * A relentless, high-value chapter boss: prioritizes finishing off low-HP
 * targets and rarely retreats. Below `enrageHpRatio` (default 50% HP) it
 * becomes willing to take near-lethal trades to secure a kill.
 */
export const bossBehavior: AIBehavior = {
    id: 'boss',

    scoreTarget(evaluation: TargetEvaluation, context: AIContext): number {
        const { forecast, target } = evaluation;
        const targetHpRatio = target.stats.maxHp > 0 ? target.stats.hp / target.stats.maxHp : 1;
        let score = forecast.expectedDamageToTarget * 2 + (1 - targetHpRatio) * 50 - forecast.expectedDamageToSelf * 0.25;
        if (forecast.lethalToTarget) {
            score += 150;
        }
        score -= forecast.selfDeathRisk * (isEnraged(evaluation, context) ? 20 : 60);
        return score;
    },

    chooseIdleTile(unit, _reachable, context: AIContext) {
        const enemy = nearestEnemy(unit, context);
        return enemy === undefined ? undefined : chooseIdleTileTowards(unit, context, enemy);
    },

    shouldEngage(evaluation: TargetEvaluation, context: AIContext): boolean {
        if (evaluation.forecast.lethalToTarget) {
            return true;
        }
        const riskCeiling = isEnraged(evaluation, context) ? 0.95 : 0.75;
        return evaluation.forecast.selfDeathRisk < riskCeiling;
    }
};
