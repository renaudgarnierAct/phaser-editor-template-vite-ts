import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ItemDefinition } from '../../data/items.ts';
import {
    addItem,
    createEmptyInventory,
    discardItem,
    equipItem,
    freeSlotCount,
    getEquippedStack,
    INVENTORY_CAPACITY,
    swapItems,
    unequip
} from '../InventorySystem.ts';

const sword: ItemDefinition = {
    id: 'item:iron-sword',
    name: 'Épée de fer',
    kind: 'weapon',
    stackable: false,
    maxStack: 1,
    price: 400,
    sellable: true
};

const vulnerary: ItemDefinition = {
    id: 'item:vulnerary',
    name: 'Fortifiant',
    kind: 'consumable',
    stackable: true,
    maxStack: 3,
    price: 300,
    sellable: true
};

const itemsById = new Map<string, ItemDefinition>([
    [sword.id, sword],
    [vulnerary.id, vulnerary]
]);

test('inventory is capped at 5 slots', () => {
    const inventory = createEmptyInventory();
    assert.equal(inventory.slots.length, INVENTORY_CAPACITY);
    assert.equal(freeSlotCount(inventory), INVENTORY_CAPACITY);
});

test('addItem tops off an existing matching stack before opening a new one', () => {
    let inventory = createEmptyInventory();
    inventory = addItem(inventory, vulnerary, 2).inventory;

    const result = addItem(inventory, vulnerary, 1);

    assert.equal(result.added, 1);
    assert.equal(result.overflow, 0);
    assert.equal(result.inventory.slots[0]?.quantity, 3);
    assert.equal(result.inventory.slots[1], null);
});

test('addItem overflows into new slots once every existing stack is at maxStack', () => {
    let inventory = createEmptyInventory();
    for (let i = 0; i < INVENTORY_CAPACITY; i += 1) {
        inventory = addItem(inventory, vulnerary, 3).inventory;
    }

    const result = addItem(inventory, vulnerary, 1);

    assert.equal(result.added, 0);
    assert.equal(result.overflow, 1);
});

test('addItem fills a new slot when the item is not stackable or no matching stack exists', () => {
    const inventory = createEmptyInventory();

    const first = addItem(inventory, sword, 1);
    assert.equal(first.added, 1);
    assert.equal(first.inventory.slots[0]?.itemId, sword.id);

    const second = addItem(first.inventory, sword, 1);
    assert.equal(second.inventory.slots[1]?.itemId, sword.id);
});

test('addItem reports overflow once every slot is full', () => {
    let inventory = createEmptyInventory();
    for (let i = 0; i < INVENTORY_CAPACITY; i += 1) {
        inventory = addItem(inventory, sword, 1).inventory;
    }

    const result = addItem(inventory, sword, 1);
    assert.equal(result.added, 0);
    assert.equal(result.overflow, 1);
});

test('equipItem sets the equipped index only for weapons', () => {
    const inventory = addItem(createEmptyInventory(), sword, 1).inventory;

    const equipped = equipItem(inventory, 0, itemsById);
    assert.equal(equipped.equippedIndex, 0);
    assert.equal(getEquippedStack(equipped)?.itemId, sword.id);
});

test('equipItem throws when trying to equip a non-weapon item', () => {
    const inventory = addItem(createEmptyInventory(), vulnerary, 1).inventory;
    assert.throws(() => equipItem(inventory, 0, itemsById));
});

test('unequip clears the equipped slot without removing the item', () => {
    let inventory = addItem(createEmptyInventory(), sword, 1).inventory;
    inventory = equipItem(inventory, 0, itemsById);

    const unequipped = unequip(inventory);

    assert.equal(unequipped.equippedIndex, undefined);
    assert.equal(unequipped.slots[0]?.itemId, sword.id);
});

test('swapItems exchanges two slots and keeps the equipped index tracking the same item', () => {
    let inventory = addItem(createEmptyInventory(), sword, 1).inventory;
    inventory = addItem(inventory, vulnerary, 1).inventory;
    inventory = equipItem(inventory, 0, itemsById);

    const swapped = swapItems(inventory, 0, 1);

    assert.equal(swapped.slots[0]?.itemId, vulnerary.id);
    assert.equal(swapped.slots[1]?.itemId, sword.id);
    assert.equal(swapped.equippedIndex, 1);
});

test('discardItem removes a partial stack quantity and the whole stack when omitted', () => {
    let inventory = addItem(createEmptyInventory(), vulnerary, 3).inventory;

    const partial = discardItem(inventory, 0, 1);
    assert.equal(partial.slots[0]?.quantity, 2);

    const emptied = discardItem(partial, 0);
    assert.equal(emptied.slots[0], null);
});

test('discardItem clears the equipped index when the equipped stack is fully discarded', () => {
    let inventory = addItem(createEmptyInventory(), sword, 1).inventory;
    inventory = equipItem(inventory, 0, itemsById);

    const discarded = discardItem(inventory, 0);

    assert.equal(discarded.slots[0], null);
    assert.equal(discarded.equippedIndex, undefined);
});

test('inventory functions do not mutate their input', () => {
    const inventory = createEmptyInventory();
    const originalSlots = inventory.slots;

    addItem(inventory, sword, 1);

    assert.equal(inventory.slots, originalSlots);
    assert.deepEqual(inventory.slots, new Array(INVENTORY_CAPACITY).fill(null));
});
