import type { ItemDefinition, ItemStack } from '../data/items.ts';
import { addItem, discardItem, type UnitInventory } from './InventorySystem.ts';

/** Default number of stacks the shared army convoy can hold, per the design document. */
export const DEFAULT_CONVOY_CAPACITY = 200;

/** The army-wide shared storage, accessible from preparation and from adjacent convoy units. */
export interface Convoy {
    capacity: number;
    stacks: ReadonlyArray<ItemStack>;
}

export function createConvoy(capacity: number = DEFAULT_CONVOY_CAPACITY): Convoy {
    return { capacity, stacks: [] };
}

/** Adds a quantity of an item to the convoy, stacking onto existing matching stacks first. */
export function depositToConvoy(convoy: Convoy, item: ItemDefinition, quantity: number): { convoy: Convoy; added: number; overflow: number } {
    if (quantity <= 0) {
        throw new Error('quantity must be positive');
    }

    const stacks = convoy.stacks.map((stack) => ({ ...stack }));
    let remaining = quantity;

    if (item.stackable) {
        for (const stack of stacks) {
            if (remaining <= 0) {
                break;
            }
            if (stack.itemId === item.id) {
                const room = item.maxStack - stack.quantity;
                const toAdd = Math.min(room, remaining);
                stack.quantity += toAdd;
                remaining -= toAdd;
            }
        }
    }

    while (remaining > 0 && stacks.length < convoy.capacity) {
        const toAdd = item.stackable ? Math.min(item.maxStack, remaining) : 1;
        stacks.push({ itemId: item.id, quantity: toAdd });
        remaining -= toAdd;
    }

    return {
        convoy: { ...convoy, stacks },
        added: quantity - remaining,
        overflow: remaining
    };
}

/** Removes (part of) a convoy stack by index; removes the whole stack if `quantity` is omitted. */
export function withdrawFromConvoy(convoy: Convoy, stackIndex: number, quantity?: number): { convoy: Convoy; removed: ItemStack | undefined } {
    const stack = convoy.stacks[stackIndex];
    if (stack === undefined) {
        return { convoy, removed: undefined };
    }

    const removeCount = quantity ?? stack.quantity;
    const stacks = convoy.stacks.map((entry) => ({ ...entry }));
    const remainingQuantity = stack.quantity - removeCount;
    if (remainingQuantity > 0) {
        stacks[stackIndex] = { itemId: stack.itemId, quantity: remainingQuantity };
    } else {
        stacks.splice(stackIndex, 1);
    }

    return { convoy: { ...convoy, stacks }, removed: { itemId: stack.itemId, quantity: removeCount } };
}

/** Moves an item stack from a unit's inventory slot into the shared convoy. */
export function transferToConvoy(
    convoy: Convoy,
    inventory: UnitInventory,
    slotIndex: number,
    item: ItemDefinition
): { convoy: Convoy; inventory: UnitInventory } {
    const slot = inventory.slots[slotIndex];
    if (slot === null) {
        return { convoy, inventory };
    }

    const deposit = depositToConvoy(convoy, item, slot.quantity);
    const updatedInventory = discardItem(inventory, slotIndex, deposit.added);
    return { convoy: deposit.convoy, inventory: updatedInventory };
}

/** Moves an item stack from the shared convoy into a unit's inventory. */
export function transferFromConvoy(
    convoy: Convoy,
    inventory: UnitInventory,
    stackIndex: number,
    item: ItemDefinition
): { convoy: Convoy; inventory: UnitInventory } {
    const stack = convoy.stacks[stackIndex];
    if (stack === undefined) {
        return { convoy, inventory };
    }

    const addResult = addItem(inventory, item, stack.quantity);
    const withdrawal = withdrawFromConvoy(convoy, stackIndex, addResult.added);
    return { convoy: withdrawal.convoy, inventory: addResult.inventory };
}
