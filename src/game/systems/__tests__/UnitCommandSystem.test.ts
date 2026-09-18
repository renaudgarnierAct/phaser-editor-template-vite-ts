import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ItemDefinition } from '../../data/items.ts';
import { createConvoy } from '../ConvoySystem.ts';
import { addItem, createEmptyInventory } from '../InventorySystem.ts';
import {
    canAct,
    executeUnitCommand,
    UnitCommandError,
    type CommandUnit,
    type UnitCommandContext
} from '../UnitCommandSystem.ts';

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

function unit(id: string, inventory = createEmptyInventory()): CommandUnit {
    return { id, faction: 'player', hp: 10, maxHp: 20, inventory, hasActed: false };
}

function context(units: CommandUnit[], convoy = createConvoy()): UnitCommandContext {
    return {
        units: new Map(units.map((entry) => [entry.id, entry])),
        itemsById: new Map([[vulnerary.id, vulnerary], [sword.id, sword]]),
        itemEffects: new Map([[vulnerary.id, { kind: 'restore_hp', amount: 8 }]]),
        convoy
    };
}

test('canAct requires a living player unit that has not acted', () => {
    assert.equal(canAct(unit('ally')), true);
    assert.equal(canAct({ ...unit('spent'), hasActed: true }), false);
    assert.equal(canAct({ ...unit('fallen'), hp: 0 }), false);
    assert.equal(canAct({ ...unit('enemy'), faction: 'enemy' }), false);
});

test('wait marks the acting unit without mutating the input context', () => {
    const actor = unit('ally');
    const state = context([actor]);

    const result = executeUnitCommand(state, { type: 'wait', actorId: actor.id });

    assert.equal(result.command, 'wait');
    assert.equal(result.units.get(actor.id)?.hasActed, true);
    assert.equal(state.units.get(actor.id)?.hasActed, false);
});

test('use_item applies a data-driven healing effect, consumes one item, and ends the action', () => {
    const actor = unit('healer', addItem(createEmptyInventory(), vulnerary, 2).inventory);
    const target = unit('ally');
    const state = context([actor, target]);

    const result = executeUnitCommand(state, {
        type: 'use_item',
        actorId: actor.id,
        slotIndex: 0,
        targetId: target.id
    });

    assert.equal(result.units.get(target.id)?.hp, 18);
    assert.equal(result.units.get(actor.id)?.inventory.slots[0]?.quantity, 1);
    assert.equal(result.units.get(actor.id)?.hasActed, true);
});

test('use_item preserves healing when the actor targets itself', () => {
    const actor = unit('self-healer', addItem(createEmptyInventory(), vulnerary, 2).inventory);

    const result = executeUnitCommand(context([actor]), {
        type: 'use_item',
        actorId: actor.id,
        slotIndex: 0
    });

    assert.equal(result.units.get(actor.id)?.hp, 18);
    assert.equal(result.units.get(actor.id)?.inventory.slots[0]?.quantity, 1);
    assert.equal(result.units.get(actor.id)?.hasActed, true);
});

test('use_item rejects missing effects and full-health targets with explicit errors', () => {
    const actor = unit('healer', addItem(createEmptyInventory(), vulnerary, 1).inventory);
    const fullHealth = { ...unit('full'), hp: 20 };
    const state = context([actor, fullHealth]);

    assert.throws(
        () => executeUnitCommand(state, { type: 'use_item', actorId: actor.id, slotIndex: 0, targetId: fullHealth.id }),
        (error: unknown) => error instanceof UnitCommandError && error.code === 'ITEM_HAS_NO_EFFECT'
    );

    const noEffects = { ...state, itemEffects: new Map() };
    assert.throws(
        () => executeUnitCommand(noEffects, { type: 'use_item', actorId: actor.id, slotIndex: 0 }),
        (error: unknown) => error instanceof UnitCommandError && error.code === 'ITEM_EFFECT_MISSING'
    );
});

test('trade transfers one item to an ally and only consumes the actor action', () => {
    const actor = unit('giver', addItem(createEmptyInventory(), sword, 1).inventory);
    const target = unit('receiver');

    const result = executeUnitCommand(context([actor, target]), {
        type: 'trade',
        actorId: actor.id,
        slotIndex: 0,
        destination: { kind: 'unit', unitId: target.id }
    });

    assert.equal(result.units.get(actor.id)?.inventory.slots[0], null);
    assert.equal(result.units.get(actor.id)?.hasActed, true);
    assert.equal(result.units.get(target.id)?.inventory.slots[0]?.itemId, sword.id);
    assert.equal(result.units.get(target.id)?.hasActed, false);
});

test('trade deposits to the convoy and rejects unavailable or full destinations', () => {
    const actor = unit('giver', addItem(createEmptyInventory(), sword, 1).inventory);
    const state = context([actor]);
    const deposited = executeUnitCommand(state, {
        type: 'trade',
        actorId: actor.id,
        slotIndex: 0,
        destination: { kind: 'convoy' }
    });

    assert.equal(deposited.convoy?.stacks[0]?.itemId, sword.id);
    assert.equal(deposited.units.get(actor.id)?.inventory.slots[0], null);

    assert.throws(
        () => executeUnitCommand({ ...state, convoy: undefined }, {
            type: 'trade',
            actorId: actor.id,
            slotIndex: 0,
            destination: { kind: 'convoy' }
        }),
        (error: unknown) => error instanceof UnitCommandError && error.code === 'CONVOY_UNAVAILABLE'
    );
});

test('commands reject unknown and already-acted actors', () => {
    const state = context([unit('spent', addItem(createEmptyInventory(), sword, 1).inventory)]);

    assert.throws(
        () => executeUnitCommand(state, { type: 'wait', actorId: 'missing' }),
        (error: unknown) => error instanceof UnitCommandError && error.code === 'ACTOR_NOT_FOUND'
    );
    assert.throws(
        () => executeUnitCommand({ ...state, units: new Map([['spent', { ...state.units.get('spent')!, hasActed: true }]]) }, {
            type: 'wait',
            actorId: 'spent'
        }),
        (error: unknown) => error instanceof UnitCommandError && error.code === 'ACTOR_CANNOT_ACT'
    );
});
