import type { StatBlock } from './stats.ts';
import type { WeaponRank, WeaponType } from './items.ts';

/**
 * Static definition of a playable/enemy class, expressed as base stats at level 1,
 * per-level growth rates (percent chance to gain +1 per level up) and stat caps.
 */
export interface ClassDefinition {
    id: string;
    name: string;
    /** Stats at level 1. */
    baseStats: StatBlock;
    /** Percent chance (0-100) per level to gain +1 in each statistic. */
    growths: StatBlock;
    /** Maximum value each statistic can reach while in this class. */
    statCaps: StatBlock;
    movement: number;
    /** Weapon types this class can wield, with the minimum rank required to start with. */
    usableWeaponTypes: Partial<Record<WeaponType, WeaponRank>>;
    /** Class ids this class can promote into, if any. */
    promotesTo?: string[];
    /** Flat stat bonus applied once, at the moment of promotion. */
    promotionBonus?: Partial<StatBlock>;
    /** Movement bonus applied at promotion (added to the base class movement). */
    promotionMovementBonus?: number;
}
