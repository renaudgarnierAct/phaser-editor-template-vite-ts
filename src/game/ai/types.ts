import type { GridPoint } from '../systems/GridSystem.ts';
import type { TerrainDefinition, UnitData } from '../data/types.ts';

/**
 * The tactical AI module is intentionally decoupled from `GridSystem` and
 * `CombatSystem`: it only reads pure data types from them (`GridPoint`,
 * `UnitData`, ...) and receives its board access through the `AIBoardQuery`
 * interface below, so it never needs a live Phaser scene, a `GridSystem`
 * instance, or any other concrete dependency to run or be unit tested.
 */

/** Built-in tactical behavior identifiers. Additional ids can be registered at runtime. */
export type AIBehaviorId = 'aggressive' | 'defensive' | 'guard' | 'boss' | (string & {});

/** Data-driven configuration for a single unit's AI, typically loaded from JSON. */
export interface AIProfile {
    /** Behavior identifier resolved through the behavior registry. */
    behavior: AIBehaviorId;
    /** Home tile a `guard` unit patrols around. Defaults to the unit's spawn point. */
    guardPoint?: GridPoint;
    /** Manhattan-distance radius (in tiles) a `guard` unit is willing to wander from `guardPoint`. */
    guardRadius?: number;
    /** Manhattan-distance radius at which a unit starts actively seeking a fight. */
    aggroRange?: number;
    /** HP ratio (0..1) below which a `defensive` unit prefers to retreat instead of engaging. */
    fleeHpRatio?: number;
    /** Free-form extra data behaviors may use (e.g. boss phase thresholds). */
    params?: Record<string, number>;
}

export type RandomSource = () => number;

/** Structural point type accepted anywhere an `{x, y}` shape is enough (units, tiles, ...). */
export interface GridPointLike {
    x: number;
    y: number;
}

/**
 * Minimal read-only view of the battlefield the AI needs. Implemented by a thin
 * adapter over `GridSystem`/`ChapterData` in production, and by lightweight
 * fakes in tests.
 */
export interface AIBoardQuery {
    readonly units: readonly UnitData[];
    terrainAt(point: GridPoint): TerrainDefinition | undefined;
    reachableFrom(origin: GridPoint, movement: number, occupied: ReadonlySet<string>): GridPoint[];
    tileKey(point: GridPoint): string;
}

/** Forecast of a single skirmish, used to compare candidate targets/tiles. */
export interface CombatForecast {
    /** Distance (Manhattan) between the two units for this forecast. */
    distance: number;
    /** Whether the target can strike back at this distance. */
    targetCanCounter: boolean;
    /** Expected damage dealt to the target across the whole exchange. */
    expectedDamageToTarget: number;
    /** Expected damage the acting unit takes back across the whole exchange. */
    expectedDamageToSelf: number;
    /** Whether a full-damage, no-crit hit sequence would already reduce the target to 0 HP. */
    lethalToTarget: boolean;
    /** Whether a full-damage, no-crit counter sequence would already reduce the acting unit to 0 HP. */
    lethalToSelf: boolean;
    /** Probability (0..1) estimate that the target dies during the exchange. */
    targetDeathRisk: number;
    /** Probability (0..1) estimate that the acting unit dies during the exchange. */
    selfDeathRisk: number;
}

/** One candidate (target, tile) pairing evaluated by the targeting step. */
export interface TargetEvaluation {
    /** The unit being evaluated, in its current (pre-move) state. */
    unit: UnitData;
    target: UnitData;
    attackFrom: GridPoint;
    forecast: CombatForecast;
    /** Score assigned by the active behavior; higher is preferred. */
    score: number;
}

export type AIActionKind = 'attack' | 'move' | 'wait';

/** Final decision produced for a single unit's turn. */
export interface AIDecision {
    unit: UnitData;
    action: AIActionKind;
    /** Tile the unit should move to before acting (or its current tile). */
    moveTo?: GridPoint;
    /** Target being attacked, only set when `action === 'attack'`. */
    target?: UnitData;
    /** Evaluation that led to the chosen target, when applicable. */
    evaluation?: TargetEvaluation;
}

export interface AIContext {
    board: AIBoardQuery;
    profile: AIProfile;
    rng?: RandomSource;
}

/**
 * Extensible strategy contract. Built-in behaviors (`aggressive`, `defensive`,
 * `guard`, `boss`) implement this, and callers can register their own via
 * `registerAIBehavior` for custom chapters/bosses without touching this file.
 */
export interface AIBehavior {
    readonly id: AIBehaviorId;
    /** Assigns a comparable score to a candidate target/tile pairing; higher wins. */
    scoreTarget(evaluation: TargetEvaluation, context: AIContext): number;
    /** Picks a destination tile from the reachable set when no attack is (yet) chosen. */
    chooseIdleTile(unit: UnitData, reachable: readonly GridPoint[], context: AIContext): GridPoint | undefined;
    /** Whether the behavior is willing to commit to the given target/tile evaluation. */
    shouldEngage(evaluation: TargetEvaluation, context: AIContext): boolean;
}
