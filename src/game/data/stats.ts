/**
 * Core RPG statistic keys shared by classes, units and growth tables.
 * Order matches the design document: PV / FOR / MAG / TEC / VIT / CHA / DEF / RES / CON.
 */
export const STAT_KEYS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'con'] as const;

export type StatKey = (typeof STAT_KEYS)[number];

/** A full set of the nine core statistics. */
export type StatBlock = Record<StatKey, number>;

/** Creates a stat block where every statistic is initialized to the same value (defaults to 0). */
export function createStatBlock(value = 0): StatBlock {
    const block = {} as StatBlock;
    for (const key of STAT_KEYS) {
        block[key] = value;
    }
    return block;
}

/** Adds two stat blocks together, key by key. */
export function addStatBlocks(a: StatBlock, b: Partial<StatBlock>): StatBlock {
    const result = createStatBlock();
    for (const key of STAT_KEYS) {
        result[key] = a[key] + (b[key] ?? 0);
    }
    return result;
}

/** Clamps every statistic in `stats` to the matching value in `caps` (no lower bound clamp). */
export function clampStatBlock(stats: StatBlock, caps: StatBlock): StatBlock {
    const result = createStatBlock();
    for (const key of STAT_KEYS) {
        result[key] = Math.min(stats[key], caps[key]);
    }
    return result;
}
