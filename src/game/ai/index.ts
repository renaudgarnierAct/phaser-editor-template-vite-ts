export type {
    AIActionKind,
    AIBehavior,
    AIBehaviorId,
    AIBoardQuery,
    AIContext,
    AIDecision,
    AIProfile,
    CombatForecast,
    GridPointLike,
    RandomSource,
    TargetEvaluation
} from './types.ts';

export { createBoardQuery } from './board.ts';
export {
    distanceTo,
    findAttackOptions,
    livingEnemiesOf,
    occupiedTileKeys,
    reachableTiles,
    threatenedTileKeys,
    type AttackOption
} from './range.ts';
export { estimateDeathProbability, forecastCombat } from './damage.ts';
export { chooseTarget, evaluateTarget } from './targeting.ts';
export { chooseIdleTileAwayFrom, chooseIdleTileTowards, closestTileTo, farthestTileFrom, nearestEnemy } from './placement.ts';
export { decideAction } from './decide.ts';
export {
    aggressiveBehavior,
    bossBehavior,
    defensiveBehavior,
    getAIBehavior,
    guardBehavior,
    listAIBehaviors,
    registerAIBehavior
} from './behaviors/index.ts';
export {
    loadAIChapterFile,
    parseAIChapterFile,
    resolveAIProfile,
    type AIChapterFile,
    type AIProfileMap
} from './loadAIProfiles.ts';
