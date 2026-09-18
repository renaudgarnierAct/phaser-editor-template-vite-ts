import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ItemDefinition } from '../../data/items.ts';
import { addItem, createEmptyInventory } from '../InventorySystem.ts';
import {
    createConvoy,
    depositToConvoy,
    transferFromConvoy,
    transferToConvoy,
    withdrawFromConvoy
} from '../ConvoySystem.ts';

const vulnerary: ItemDefinition = {
    id: 'item:vulnerary',
    name: 'Fortifiant',
    kind: 'consumable',
    stackable: true,
    maxStack: 3,
    price: 300,
    sellable: true
};

const sword: ItemDefinition = {
    id: 'item:iron-sword',
    name: 'Épée de fer',
    kind: 'weapon',
    stackable: false,
    maxStack: 1,
    price: 400,
    sellable: true
};

test('createConvoy defaults to a capacity of 200 stacks', () => {
    const convoy = createConvoy();
    assert.equal(convoy.capacity, 200);
    assert.deepEqual(convoy.stacks, []);
});

test('depositToConvoy tops off an existing matching stack before opening a new one', () => {
    let convoy = createConvoy();
    convoy = depositToConvoy(convoy, vulnerary, 2).convoy;

    const result = depositToConvoy(convoy, vulnerary, 1);

    assert.equal(result.added, 1);
    assert.equal(result.overflow, 0);
    assert.equal(result.convoy.stacks[0]?.quantity, 3);
    assert.equal(result.convoy.stacks.length, 1);
});

test('depositToConvoy reports overflow once capacity is reached', () => {
    const convoy = createConvoy(1);
    const first = depositToConvoy(convoy, sword, 1);
    const second = depositToConvoy(first.convoy, sword, 1);

    assert.equal(second.added, 0);
    assert.equal(second.overflow, 1);
});

test('withdrawFromConvoy removes a partial quantity and the whole stack when omitted', () => {
    const convoy = depositToConvoy(createConvoy(), vulnerary, 3).convoy;

    const partial = withdrawFromConvoy(convoy, 0, 1);
    assert.equal(partial.removed?.quantity, 1);
    assert.equal(partial.convoy.stacks[0]?.quantity, 2);

    const emptied = withdrawFromConvoy(partial.convoy, 0);
    assert.equal(emptied.removed?.quantity, 2);
    assert.equal(emptied.convoy.stacks.length, 0);
});

test('transferToConvoy moves an item from a unit inventory into the shared convoy', () => {
    const inventory = addItem(createEmptyInventory(), sword, 1).inventory;
    const convoy = createConvoy();

    const result = transferToConvoy(convoy, inventory, 0, sword);

    assert.equal(result.inventory.slots[0], null);
    assert.equal(result.convoy.stacks[0]?.itemId, sword.id);
});

test('transferFromConvoy moves a convoy stack back into a unit inventory', () => {
    const convoy = depositToConvoy(createConvoy(), sword, 1).convoy;
    const inventory = createEmptyInventory();

    const result = transferFromConvoy(convoy, inventory, 0, sword);

    assert.equal(result.convoy.stacks.length, 0);
    assert.equal(result.inventory.slots[0]?.itemId, sword.id);
});

test('convoy functions do not mutate their input', () => {
    const convoy = createConvoy();
    const originalStacks = convoy.stacks;

    depositToConvoy(convoy, vulnerary, 1);

    assert.equal(convoy.stacks, originalStacks);
});
