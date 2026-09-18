import {
    NO_TERRAIN_BONUS,
    manhattanDistance,
    previewCombat,
    type TerrainCombatBonus
} from '../systems/CombatSystem.ts';
import type { UnitData } from '../data/types.ts';
import type { CombatForecast } from './types.ts';

interface AttackChance {
    hitChance: number;
    critChance: number;
    damage: number;
    count: number;
}

/** Expected damage of a single attack roll, folding in the critical multiplier. */
function expectedDamagePerAttack(chance: AttackChance): number {
    if (chance.damage <= 0 || chance.hitChance <= 0) {
        return 0;
    }
    const hit = chance.hitChance / 100;
    const crit = Math.max(0, Math.min(1, chance.critChance / 100));
    const perHit = chance.damage * (1 - crit) + chance.damage * 3 * crit;
    return hit * perHit * chance.count;
}

/**
 * Estimates the probability that a target with `hp` remaining dies to the
 * given sequence of attack rolls, by enumerating the (miss / hit / crit)
 * outcome tree. The tree is tiny in practice (at most two attacks per side
 * in this game's combat model), so exhaustive enumeration stays cheap and
 * exact rather than relying on a Monte-Carlo approximation.
 */
export function estimateDeathProbability(hp: number, attacks: readonly AttackChance[]): number {
    if (hp <= 0) {
        return 1;
    }

    const rolls = attacks.flatMap((attack) => Array.from({ length: attack.count }, () => attack));
    if (rolls.length === 0) {
        return 0;
    }

    let probabilityOfDeath = 0;

    const walk = (index: number, damageSoFar: number, chanceSoFar: number): void => {
        if (chanceSoFar <= 0) {
            return;
        }
        if (index === rolls.length) {
            if (damageSoFar >= hp) {
                probabilityOfDeath += chanceSoFar;
            }
            return;
        }

        const roll = rolls[index];
        const hit = roll.hitChance / 100;
        const crit = Math.max(0, Math.min(1, roll.critChance / 100));

        walk(index + 1, damageSoFar, chanceSoFar * (1 - hit));
        walk(index + 1, damageSoFar + roll.damage, chanceSoFar * hit * (1 - crit));
        walk(index + 1, damageSoFar + roll.damage * 3, chanceSoFar * hit * crit);
    };

    walk(0, 0, 1);
    return Math.min(1, probabilityOfDeath);
}

/**
 * Forecasts an attacker/defender exchange without rolling any dice, reusing
 * `CombatSystem.previewCombat` for the underlying hit/crit/damage math and
 * layering AI-specific expectations (expected damage, lethality, death risk)
 * on top of it.
 */
export function forecastCombat(
    attacker: UnitData,
    defender: UnitData,
    attackerTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS,
    defenderTerrain: TerrainCombatBonus = NO_TERRAIN_BONUS
): CombatForecast {
    const preview = previewCombat(attacker, defender, attackerTerrain, defenderTerrain);
    const distance = manhattanDistance(attacker, defender);

    const attackerAttacks: AttackChance = {
        hitChance: preview.attackerHitChance,
        critChance: preview.attackerCritChance,
        damage: preview.attackerDamage,
        count: preview.attackerDoubles ? 2 : 1
    };
    const defenderAttacks: AttackChance = {
        hitChance: preview.defenderHitChance,
        critChance: preview.defenderCritChance,
        damage: preview.defenderDamage,
        count: preview.defenderCanCounter ? (preview.defenderDoubles ? 2 : 1) : 0
    };

    const expectedDamageToTarget = expectedDamagePerAttack(attackerAttacks);
    const expectedDamageToSelf = expectedDamagePerAttack(defenderAttacks);

    return {
        distance,
        targetCanCounter: preview.defenderCanCounter,
        expectedDamageToTarget,
        expectedDamageToSelf,
        lethalToTarget: attackerAttacks.damage * attackerAttacks.count >= defender.stats.hp && attackerAttacks.damage > 0,
        lethalToSelf: defenderAttacks.damage * defenderAttacks.count >= attacker.stats.hp && defenderAttacks.damage > 0,
        targetDeathRisk: estimateDeathProbability(defender.stats.hp, [attackerAttacks]),
        selfDeathRisk: estimateDeathProbability(attacker.stats.hp, [defenderAttacks])
    };
}
