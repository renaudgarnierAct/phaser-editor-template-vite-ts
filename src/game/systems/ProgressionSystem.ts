import type { ClassDefinition } from '../data/classes.ts';
import { addStatBlocks, clampStatBlock, createStatBlock, STAT_KEYS, type StatBlock } from '../data/stats.ts';

/** Experience required to gain exactly one level, per the design document. */
export const XP_PER_LEVEL = 100;

/** A unit's mutable level/experience/stat progression state. */
export interface UnitProgress {
    classId: string;
    level: number;
    /** Experience accumulated towards the next level, in the range [0, 100). */
    xp: number;
    stats: StatBlock;
}

/** Creates a fresh level-1 progression state from a class definition's base stats. */
export function createUnitProgress(classDefinition: ClassDefinition): UnitProgress {
    return {
        classId: classDefinition.id,
        level: 1,
        xp: 0,
        stats: { ...classDefinition.baseStats }
    };
}

/** Deterministic pseudo-random source used by the progression system; injectable for tests. */
export type RandomSource = () => number;

/**
 * Rolls one level-up's worth of stat growth for a class, using `rng()` values in [0, 1).
 * Each statistic has an independent `growths[stat]` percent chance of gaining +1.
 */
export function rollStatGrowth(classDefinition: ClassDefinition, rng: RandomSource = Math.random): Partial<StatBlock> {
    const gains: Partial<StatBlock> = {};
    for (const key of STAT_KEYS) {
        const chance = classDefinition.growths[key] / 100;
        if (rng() < chance) {
            gains[key] = (gains[key] ?? 0) + 1;
        }
    }
    return gains;
}

export interface LevelUpResult {
    progress: UnitProgress;
    /** Number of levels gained (0 if the xp gain did not cross a level threshold). */
    levelsGained: number;
    /** Total stat gains accrued across every level gained, already clamped to class caps. */
    totalGains: Partial<StatBlock>;
}

/**
 * Adds `xpGained` experience to a unit's progression, rolling stat growth for every level
 * crossed. Stats are clamped to the class's caps after each level. Pure function: returns a
 * new {@link UnitProgress} and never mutates its input.
 */
export function addExperience(
    progress: UnitProgress,
    classDefinition: ClassDefinition,
    xpGained: number,
    rng: RandomSource = Math.random
): LevelUpResult {
    if (xpGained < 0) {
        throw new Error('xpGained must not be negative');
    }

    let xp = progress.xp + xpGained;
    let level = progress.level;
    let stats = progress.stats;
    let levelsGained = 0;
    const totalGains: Partial<StatBlock> = {};

    while (xp >= XP_PER_LEVEL) {
        xp -= XP_PER_LEVEL;
        level += 1;
        levelsGained += 1;

        const gains = rollStatGrowth(classDefinition, rng);
        stats = clampStatBlock(addStatBlocks(stats, gains), classDefinition.statCaps);
        for (const key of STAT_KEYS) {
            if (gains[key]) {
                totalGains[key] = (totalGains[key] ?? 0) + gains[key];
            }
        }
    }

    return {
        progress: { ...progress, xp, level, stats },
        levelsGained,
        totalGains
    };
}

/** Applies a class promotion: switches class, adds the promotion bonus and clamps to new caps. */
export function promote(progress: UnitProgress, fromClass: ClassDefinition, toClass: ClassDefinition): UnitProgress {
    if (!fromClass.promotesTo?.includes(toClass.id)) {
        throw new Error(`Class "${fromClass.id}" cannot promote into "${toClass.id}"`);
    }

    const bonus = fromClass.promotionBonus ?? createStatBlock(0);
    const stats = clampStatBlock(addStatBlocks(progress.stats, bonus), toClass.statCaps);

    return { ...progress, classId: toClass.id, stats };
}

export interface ExperienceGainParams {
    attackerLevel: number;
    defenderLevel: number;
    /** True if this action defeated its target. */
    defeated: boolean;
    /** True for support actions (healing) rather than damage. */
    isHealing?: boolean;
    /** Minimum experience granted for any valid, non-trivial action. */
    minimumGain?: number;
}

/**
 * Computes experience earned for one combat/support action, per the design document: gain
 * scales with the level difference between the two units, is reduced (never negative) when the
 * attacker heavily outlevels the target, and grants a bonus for a kill.
 */
export function computeExperienceGain(params: ExperienceGainParams): number {
    const { attackerLevel, defenderLevel, defeated, isHealing = false, minimumGain = 1 } = params;

    const levelDiff = defenderLevel - attackerLevel;
    const base = isHealing ? 8 : 15;
    // Each level the defender is above the attacker adds bonus xp; each level below reduces it,
    // down to (but not below) the configured minimum, so high level units farming weak enemies
    // cannot exploit them indefinitely.
    const scaled = base + levelDiff * 2;
    const clamped = Math.max(minimumGain, Math.min(base * 2, scaled));

    const killBonus = !isHealing && defeated ? 20 : 0;
    return Math.round(clamped + killBonus);
}
