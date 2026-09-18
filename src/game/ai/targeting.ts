import type { UnitData } from '../data/types.ts';
import { forecastCombat } from './damage.ts';
import { findAttackOptions } from './range.ts';
import type { AIBehavior, AIContext, TargetEvaluation } from './types.ts';

function terrainBonusFor(unit: UnitData, context: AIContext) {
    const terrain = context.board.terrainAt({ x: unit.x, y: unit.y });
    return terrain === undefined ? undefined : { defense: terrain.defense, avoid: terrain.avoid };
}

/**
 * Builds the full evaluation (forecast + behavior score) for attacking
 * `target` after moving to `attackFrom`.
 */
export function evaluateTarget(
    unit: UnitData,
    target: UnitData,
    attackFrom: { x: number; y: number },
    context: AIContext,
    behavior: AIBehavior
): TargetEvaluation {
    const actingUnit: UnitData = { ...unit, x: attackFrom.x, y: attackFrom.y };
    const forecast = forecastCombat(actingUnit, target, terrainBonusFor(actingUnit, context), terrainBonusFor(target, context));
    const evaluation: TargetEvaluation = { unit, target, attackFrom, forecast, score: 0 };
    evaluation.score = behavior.scoreTarget(evaluation, context);
    return evaluation;
}

/**
 * Evaluates every reachable (tile, enemy) pairing available to `unit` and
 * returns the highest-scoring one according to `behavior`, or `undefined`
 * when no enemy can be reached this turn.
 */
export function chooseTarget(unit: UnitData, context: AIContext, behavior: AIBehavior): TargetEvaluation | undefined {
    const options = findAttackOptions(unit, context.board);
    if (options.length === 0) {
        return undefined;
    }

    let best: TargetEvaluation | undefined;
    for (const option of options) {
        const evaluation = evaluateTarget(unit, option.target, option.tile, context, behavior);
        if (best === undefined || evaluation.score > best.score) {
            best = evaluation;
        }
    }

    return best;
}
