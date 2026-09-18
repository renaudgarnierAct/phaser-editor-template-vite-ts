import type { WeaponDefinition, WeaponType } from '../data/items.ts';
import { WEAPON_RANKS, type WeaponRank } from '../data/items.ts';

/** Default experience thresholds required to reach each weapon rank, per the design document. */
export const WEAPON_RANK_THRESHOLDS: Record<WeaponRank, number> = {
    E: 0,
    D: 30,
    C: 70,
    B: 120,
    A: 180,
    S: 255
};

/** A unit's accumulated weapon experience per weapon type. */
export type WeaponRankProgress = Partial<Record<WeaponType, number>>;

/** Returns the highest rank whose threshold is met or exceeded by `experience`. */
export function rankForExperience(
    experience: number,
    thresholds: Record<WeaponRank, number> = WEAPON_RANK_THRESHOLDS
): WeaponRank {
    let current: WeaponRank = WEAPON_RANKS[0];
    for (const rank of WEAPON_RANKS) {
        if (experience >= thresholds[rank]) {
            current = rank;
        }
    }
    return current;
}

/** Compares two ranks; returns a negative number if `a` is lower than `b`, 0 if equal, positive otherwise. */
export function compareRanks(a: WeaponRank, b: WeaponRank): number {
    return WEAPON_RANKS.indexOf(a) - WEAPON_RANKS.indexOf(b);
}

/** Reads the current experience for a weapon type, defaulting to 0. */
export function getWeaponExperience(progress: WeaponRankProgress, weaponType: WeaponType): number {
    return progress[weaponType] ?? 0;
}

/** Reads the current rank a unit holds for a weapon type, defaulting to "E". */
export function getWeaponRank(
    progress: WeaponRankProgress,
    weaponType: WeaponType,
    thresholds: Record<WeaponRank, number> = WEAPON_RANK_THRESHOLDS
): WeaponRank {
    return rankForExperience(getWeaponExperience(progress, weaponType), thresholds);
}

/**
 * Grants weapon experience for a valid use of `weaponType`. Pure function: returns a new
 * {@link WeaponRankProgress} object and never mutates its input.
 */
export function gainWeaponExperience(
    progress: WeaponRankProgress,
    weaponType: WeaponType,
    amount: number
): WeaponRankProgress {
    if (amount < 0) {
        throw new Error('amount must not be negative');
    }

    return {
        ...progress,
        [weaponType]: getWeaponExperience(progress, weaponType) + amount
    };
}

/** Whether a unit's current rank in a weapon's type meets or exceeds the rank the weapon requires. */
export function canUseWeapon(
    progress: WeaponRankProgress,
    weapon: WeaponDefinition,
    thresholds: Record<WeaponRank, number> = WEAPON_RANK_THRESHOLDS
): boolean {
    return compareRanks(getWeaponRank(progress, weapon.weaponType, thresholds), weapon.rank) >= 0;
}
