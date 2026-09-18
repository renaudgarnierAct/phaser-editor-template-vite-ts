import type { ItemDefinition, ItemStack } from '../data/items.ts';
import { isWeaponDefinition } from '../data/items.ts';

/** Fixed number of inventory slots per unit, per the design document. */
export const INVENTORY_CAPACITY = 5;

/** A unit's inventory: up to {@link INVENTORY_CAPACITY} item stacks, one of which may be equipped. */
export interface UnitInventory {
    /** Fixed-length array of slots; `null` means the slot is empty. */
    slots: ReadonlyArray<ItemStack | null>;
    /** Index of the equipped weapon slot, or `undefined` if nothing is equipped. */
    equippedIndex?: number;
}

export function createEmptyInventory(): UnitInventory {
    return { slots: new Array<ItemStack | null>(INVENTORY_CAPACITY).fill(null) };
}

function cloneSlots(inventory: UnitInventory): (ItemStack | null)[] {
    return [...inventory.slots];
}

export interface AddItemResult {
    inventory: UnitInventory;
    /** Quantity actually added to the inventory (may be less than requested if it doesn't fit). */
    added: number;
    /** Quantity that could not be added because the inventory is full or the stack is capped. */
    overflow: number;
}

/**
 * Adds a quantity of an item to a unit's inventory, stacking onto an existing matching stack
 * (up to its item definition's `maxStack`) before using empty slots. Pure function.
 */
export function addItem(inventory: UnitInventory, item: ItemDefinition, quantity: number): AddItemResult {
    if (quantity <= 0) {
        throw new Error('quantity must be positive');
    }

    const slots = cloneSlots(inventory);
    let remaining = quantity;

    if (item.stackable) {
        for (let i = 0; i < slots.length && remaining > 0; i += 1) {
            const slot = slots[i];
            if (slot !== null && slot.itemId === item.id) {
                const room = item.maxStack - slot.quantity;
                const toAdd = Math.min(room, remaining);
                if (toAdd > 0) {
                    slots[i] = { itemId: item.id, quantity: slot.quantity + toAdd };
                    remaining -= toAdd;
                }
            }
        }
    }

    for (let i = 0; i < slots.length && remaining > 0; i += 1) {
        if (slots[i] === null) {
            const toAdd = item.stackable ? Math.min(item.maxStack, remaining) : 1;
            slots[i] = { itemId: item.id, quantity: toAdd };
            remaining -= toAdd;
        }
    }

    return {
        inventory: { ...inventory, slots },
        added: quantity - remaining,
        overflow: remaining
    };
}

/** Removes (part of) a stack from a slot; discards the whole stack if `quantity` is omitted. */
export function discardItem(inventory: UnitInventory, slotIndex: number, quantity?: number): UnitInventory {
    assertValidIndex(slotIndex);
    const slots = cloneSlots(inventory);
    const slot = slots[slotIndex];
    if (slot === null) {
        return inventory;
    }

    const removeCount = quantity ?? slot.quantity;
    const remainingQuantity = slot.quantity - removeCount;
    slots[slotIndex] = remainingQuantity > 0 ? { itemId: slot.itemId, quantity: remainingQuantity } : null;

    const equippedIndex = slots[slotIndex] === null && inventory.equippedIndex === slotIndex
        ? undefined
        : inventory.equippedIndex;

    return { slots, equippedIndex };
}

/** Swaps the contents of two inventory slots, keeping the equipped index pointed at the same item. */
export function swapItems(inventory: UnitInventory, slotA: number, slotB: number): UnitInventory {
    assertValidIndex(slotA);
    assertValidIndex(slotB);
    const slots = cloneSlots(inventory);
    [slots[slotA], slots[slotB]] = [slots[slotB], slots[slotA]];

    let equippedIndex = inventory.equippedIndex;
    if (equippedIndex === slotA) {
        equippedIndex = slotB;
    } else if (equippedIndex === slotB) {
        equippedIndex = slotA;
    }

    return { slots, equippedIndex };
}

/** Equips the weapon held in `slotIndex` as the unit's active weapon. */
export function equipItem(inventory: UnitInventory, slotIndex: number, itemsById: Map<string, ItemDefinition>): UnitInventory {
    assertValidIndex(slotIndex);
    const slot = inventory.slots[slotIndex];
    if (slot === null) {
        throw new Error(`Slot ${slotIndex} is empty`);
    }

    const item = itemsById.get(slot.itemId);
    if (item === undefined || !isWeaponDefinition(item)) {
        throw new Error(`Item "${slot.itemId}" is not equippable`);
    }

    return { ...inventory, equippedIndex: slotIndex };
}

/** Clears the equipped weapon, if any (the unit becomes unarmed). */
export function unequip(inventory: UnitInventory): UnitInventory {
    return { ...inventory, equippedIndex: undefined };
}

/** Returns the item stack currently equipped, or `undefined` if nothing is equipped. */
export function getEquippedStack(inventory: UnitInventory): ItemStack | undefined {
    return inventory.equippedIndex === undefined ? undefined : inventory.slots[inventory.equippedIndex] ?? undefined;
}

/** Number of empty slots remaining. */
export function freeSlotCount(inventory: UnitInventory): number {
    return inventory.slots.filter((slot) => slot === null).length;
}

function assertValidIndex(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= INVENTORY_CAPACITY) {
        throw new Error(`slotIndex must be between 0 and ${INVENTORY_CAPACITY - 1}`);
    }
}
