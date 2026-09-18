/** Weapon families a class can be proficient with. */
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow' | 'tome' | 'staff';

/** Weapon proficiency ranks, from least to most skilled. */
export const WEAPON_RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

export type WeaponRank = (typeof WEAPON_RANKS)[number];

/** Broad category of an inventory item, used to decide how it can be used/equipped. */
export type ItemKind = 'weapon' | 'consumable' | 'key' | 'valuable';

/** Base fields shared by every item definition. */
export interface ItemDefinition {
    id: string;
    name: string;
    kind: ItemKind;
    /** Whether multiple copies of this item merge into a single stack. */
    stackable: boolean;
    /** Maximum quantity per stack when stackable (ignored otherwise). */
    maxStack: number;
    /** Base sale price in gold; items that cannot be sold should omit this or set it to 0. */
    price: number;
    /** Key items and unique rewards are protected against selling. */
    sellable: boolean;
}

/** A usable weapon, extending the base item with combat-relevant fields. */
export interface WeaponDefinition extends ItemDefinition {
    kind: 'weapon';
    weaponType: WeaponType;
    rank: WeaponRank;
    might: number;
    hit: number;
    crit: number;
    /** Inclusive [min, max] attack range. */
    range: [number, number];
    weight: number;
    /** Effectiveness tags this weapon triples/doubles damage against (e.g. "cavalry", "flying"). */
    effectiveness?: string[];
    /** Amount of weapon experience granted for a valid use of this weapon (defaults to 1 if omitted). */
    experienceValue?: number;
}

/** A stack of a given item and its quantity, as held by a unit or the convoy. */
export interface ItemStack {
    itemId: string;
    quantity: number;
}

export function isWeaponDefinition(item: ItemDefinition): item is WeaponDefinition {
    return item.kind === 'weapon';
}
