import type { UnitData, WeaponData } from '../data/types';

/**
 * Pure, framework-agnostic combat resolution. Every function here is a plain
 * calculation that can be unit tested without booting Phaser, and randomness
 * is injected so outcomes can be made deterministic in tests.
 */

export interface TerrainCombatBonus {
    defense: number;
    avoid: number;
}

export const NO_TERRAIN_BONUS: Readonly<TerrainCombatBonus> = { defense: 0, avoid: 0 };

export type CombatSide = 'attacker' | 'defender';

export interface CombatOutcome {
    actor: CombatSide;
    hit: boolean;
    critical: boolean;
    damage: number;
    targetHpAfter: number;
}

export interface CombatPreview {
    attackerHitChance: number;
    attackerCritChance: number;
    attackerDamage: number;
    attackerDoubles: boolean;
    defenderCanCounter: boolean;
    defenderHitChance: number;
    defenderCritChance: number;
    defenderDamage: number;
    defenderDoubles: boolean;
}

export interface CombatResult extends CombatPreview {
    rounds: CombatOutcome[];
    attackerHpAfter: number;
    defenderHpAfter: number;
    attackerDefeated: boolean;
    defenderDefeated: boolean;
}

export type RandomSource = () => number;

const CRITICAL_MULTIPLIER = 3;

export function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isInWeaponRange(weapon: WeaponData, distance: number): boolean {
    return distance >= weapon.minRange && distance <= weapon.maxRange;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function computeDamage(attacker: UnitData, defender: UnitData, defenderTerrain: TerrainCombatBonus): number {
    const raw = attacker.stats.attack + attacker.weapon.might - (defender.stats.defense + defenderTerrain.defense);
    return Math.max(0, raw);
}

function computeHitChance(attacker: UnitData, defender: UnitData, defenderTerrain: TerrainCombatBonus): number {
    const accuracy = attacker.weapon.hit + Math.floor(attacker.stats.luck / 2);
    const avoid = defender.stats.speed * 2 + defenderTerrain.avoid;
    return clamp(accuracy - avoid, 0, 100);
}

function computeCritChance(attacker: UnitData, defender: UnitData): number {
    const critical = attacker.weapon.crit + Math.floor(attacker.stats.luck / 2) - defender.stats.luck;
    return clamp(critical, 0, 100);
}

function computeDoubles(attacker: UnitData, defender: UnitData): boolean {
    return attacker.stats.speed - defender.stats.speed >= 4;
}

/**
 * Computes the deterministic combat odds/damage without rolling any dice.
 * Used both to render a preview to the player and as the basis for resolution.
 */
export function previewCombat(
    attacker: UnitData,
    defender: UnitData,
    attackerTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS,
    defenderTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS
): CombatPreview {
    const distance = manhattanDistance(attacker, defender);
    const defenderCanCounter = defender.stats.hp > 0 && isInWeaponRange(defender.weapon, distance);

    return {
        attackerHitChance: computeHitChance(attacker, defender, defenderTerrain),
        attackerCritChance: computeCritChance(attacker, defender),
        attackerDamage: computeDamage(attacker, defender, defenderTerrain),
        attackerDoubles: computeDoubles(attacker, defender),
        defenderCanCounter,
        defenderHitChance: defenderCanCounter ? computeHitChance(defender, attacker, attackerTerrain) : 0,
        defenderCritChance: defenderCanCounter ? computeCritChance(defender, attacker) : 0,
        defenderDamage: defenderCanCounter ? computeDamage(defender, attacker, attackerTerrain) : 0,
        defenderDoubles: defenderCanCounter && computeDoubles(defender, attacker)
    };
}

/**
 * Resolves a full combat exchange (attack, optional counter, optional double
 * attack) using an injectable random source so results are reproducible in
 * tests. `rng` must return a value in [0, 1); defaults to `Math.random`.
 */
export function resolveCombat(
    attacker: UnitData,
    defender: UnitData,
    attackerTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS,
    defenderTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS,
    rng: RandomSource = Math.random
): CombatResult {
    const preview = previewCombat(attacker, defender, attackerTerrain, defenderTerrain);

    let attackerHp = attacker.stats.hp;
    let defenderHp = defender.stats.hp;
    const rounds: CombatOutcome[] = [];

    const order: CombatSide[] = ['attacker'];
    if (preview.defenderCanCounter) {
        order.push('defender');
    }
    if (preview.attackerDoubles) {
        order.push('attacker');
    } else if (preview.defenderDoubles) {
        order.push('defender');
    }

    for (const actor of order) {
        if (attackerHp <= 0 || defenderHp <= 0) {
            continue;
        }

        const hitChance = actor === 'attacker' ? preview.attackerHitChance : preview.defenderHitChance;
        const critChance = actor === 'attacker' ? preview.attackerCritChance : preview.defenderCritChance;
        const baseDamage = actor === 'attacker' ? preview.attackerDamage : preview.defenderDamage;

        const hit = rng() * 100 < hitChance;
        let critical = false;
        let damage = 0;

        if (hit) {
            critical = rng() * 100 < critChance;
            damage = critical ? baseDamage * CRITICAL_MULTIPLIER : baseDamage;
            if (actor === 'attacker') {
                defenderHp = Math.max(0, defenderHp - damage);
            } else {
                attackerHp = Math.max(0, attackerHp - damage);
            }
        }

        rounds.push({
            actor,
            hit,
            critical,
            damage,
            targetHpAfter: actor === 'attacker' ? defenderHp : attackerHp
        });
    }

    return {
        ...preview,
        rounds,
        attackerHpAfter: attackerHp,
        defenderHpAfter: defenderHp,
        attackerDefeated: attackerHp <= 0,
        defenderDefeated: defenderHp <= 0
    };
}
