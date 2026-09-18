import type { Faction } from '../data/types.ts';
import type { ItemDefinition } from '../data/items.ts';
import { transferToConvoy, type Convoy } from './ConvoySystem.ts';
import { addItem, discardItem, type UnitInventory } from './InventorySystem.ts';

export type UnitCommandName = 'wait' | 'use_item' | 'trade';
export type UnitCommandErrorCode =
    | 'ACTOR_NOT_FOUND'
    | 'ACTOR_CANNOT_ACT'
    | 'TARGET_NOT_FOUND'
    | 'TARGET_INVALID'
    | 'ITEM_SLOT_EMPTY'
    | 'ITEM_NOT_FOUND'
    | 'ITEM_NOT_USABLE'
    | 'ITEM_EFFECT_MISSING'
    | 'ITEM_EFFECT_INVALID'
    | 'ITEM_HAS_NO_EFFECT'
    | 'TRADE_DESTINATION_FULL'
    | 'CONVOY_UNAVAILABLE'
    | 'CONVOY_FULL';

export class UnitCommandError extends Error {
    public readonly code: UnitCommandErrorCode;

    constructor(code: UnitCommandErrorCode, message: string) {
        super(message);
        this.name = 'UnitCommandError';
        this.code = code;
    }
}

/** Minimal mutable unit state required to resolve commands outside a Phaser scene. */
export interface CommandUnit {
    id: string;
    faction: Faction;
    hp: number;
    maxHp: number;
    inventory: UnitInventory;
    hasActed: boolean;
}

export interface RestoreHpEffect {
    kind: 'restore_hp';
    amount: number;
}

/** Data-driven definitions for items whose effects are resolved by this system. */
export type ItemEffect = RestoreHpEffect;

export interface UnitCommandContext {
    units: ReadonlyMap<string, CommandUnit>;
    itemsById: ReadonlyMap<string, ItemDefinition>;
    itemEffects: ReadonlyMap<string, ItemEffect>;
    convoy?: Convoy;
}

export interface WaitCommand {
    type: 'wait';
    actorId: string;
}

export interface UseItemCommand {
    type: 'use_item';
    actorId: string;
    slotIndex: number;
    targetId?: string;
}

export interface TradeToUnit {
    kind: 'unit';
    unitId: string;
}

export interface TradeToConvoy {
    kind: 'convoy';
}

export interface TradeCommand {
    type: 'trade';
    actorId: string;
    slotIndex: number;
    destination: TradeToUnit | TradeToConvoy;
}

export type UnitCommand = WaitCommand | UseItemCommand | TradeCommand;

export interface UnitCommandResult {
    command: UnitCommandName;
    units: ReadonlyMap<string, CommandUnit>;
    convoy?: Convoy;
}

/** True when a living player unit has not already consumed its action this turn. */
export function canAct(unit: CommandUnit | undefined): unit is CommandUnit {
    return unit !== undefined && unit.faction === 'player' && unit.hp > 0 && !unit.hasActed;
}

/**
 * Resolves a reusable unit command without mutating its context. Scene and UI code can keep
 * command state separately, then replace it with the returned state after a successful command.
 */
export function executeUnitCommand(context: UnitCommandContext, command: UnitCommand): UnitCommandResult {
    const actor = context.units.get(command.actorId);
    if (actor === undefined) {
        throw new UnitCommandError('ACTOR_NOT_FOUND', `Unit "${command.actorId}" does not exist`);
    }
    if (!canAct(actor)) {
        throw new UnitCommandError('ACTOR_CANNOT_ACT', `Unit "${actor.id}" cannot act`);
    }

    switch (command.type) {
        case 'wait':
            return replaceUnits(context, command.type, new Map([[actor.id, acted(actor)]]));
        case 'use_item':
            return useItem(context, command, actor);
        case 'trade':
            return trade(context, command, actor);
    }
}

function useItem(context: UnitCommandContext, command: UseItemCommand, actor: CommandUnit): UnitCommandResult {
    const target = context.units.get(command.targetId ?? actor.id);
    if (target === undefined) {
        throw new UnitCommandError('TARGET_NOT_FOUND', `Unit "${command.targetId}" does not exist`);
    }
    if (target.hp <= 0) {
        throw new UnitCommandError('TARGET_INVALID', `Unit "${target.id}" is defeated`);
    }

    const item = getItemInSlot(context, actor, command.slotIndex);
    if (item.kind !== 'consumable') {
        throw new UnitCommandError('ITEM_NOT_USABLE', `Item "${item.id}" is not a consumable`);
    }

    const effect = context.itemEffects.get(item.id);
    if (effect === undefined) {
        throw new UnitCommandError('ITEM_EFFECT_MISSING', `Consumable "${item.id}" has no configured effect`);
    }
    if (effect.kind !== 'restore_hp' || effect.amount <= 0) {
        throw new UnitCommandError('ITEM_EFFECT_INVALID', `Consumable "${item.id}" has an invalid effect`);
    }
    if (target.hp >= target.maxHp) {
        throw new UnitCommandError('ITEM_HAS_NO_EFFECT', `Unit "${target.id}" is already at full health`);
    }

    const healedTarget = { ...target, hp: Math.min(target.maxHp, target.hp + effect.amount) };
    const actorAfterHealing = target.id === actor.id ? healedTarget : actor;
    const updatedActor = acted({
        ...actorAfterHealing,
        inventory: discardItem(actor.inventory, command.slotIndex, 1)
    });
    if (target.id === actor.id) {
        return replaceUnits(context, command.type, new Map([[updatedActor.id, updatedActor]]));
    }
    return replaceUnits(context, command.type, new Map([
        [healedTarget.id, healedTarget],
        [updatedActor.id, updatedActor]
    ]));
}

function trade(context: UnitCommandContext, command: TradeCommand, actor: CommandUnit): UnitCommandResult {
    const item = getItemInSlot(context, actor, command.slotIndex);

    if (command.destination.kind === 'convoy') {
        if (context.convoy === undefined) {
            throw new UnitCommandError('CONVOY_UNAVAILABLE', 'A convoy is required for this trade');
        }
        const transfer = transferToConvoy(context.convoy, actor.inventory, command.slotIndex, item);
        if (transfer.convoy === context.convoy) {
            throw new UnitCommandError('CONVOY_FULL', 'The convoy cannot accept this item');
        }
        return replaceUnits(context, command.type, new Map([
            [actor.id, acted({ ...actor, inventory: transfer.inventory })]
        ]), transfer.convoy);
    }

    const target = context.units.get(command.destination.unitId);
    if (target === undefined) {
        throw new UnitCommandError('TARGET_NOT_FOUND', `Unit "${command.destination.unitId}" does not exist`);
    }
    if (target.id === actor.id || target.faction !== actor.faction || target.hp <= 0) {
        throw new UnitCommandError('TARGET_INVALID', `Unit "${target.id}" is not a valid trade partner`);
    }

    const received = addItem(target.inventory, item, 1);
    if (received.added !== 1) {
        throw new UnitCommandError('TRADE_DESTINATION_FULL', `Unit "${target.id}" has no space for "${item.id}"`);
    }
    const updatedActor = acted({ ...actor, inventory: discardItem(actor.inventory, command.slotIndex, 1) });
    return replaceUnits(context, command.type, new Map([
        [updatedActor.id, updatedActor],
        [target.id, { ...target, inventory: received.inventory }]
    ]));
}

function getItemInSlot(context: UnitCommandContext, unit: CommandUnit, slotIndex: number): ItemDefinition {
    const stack = unit.inventory.slots[slotIndex];
    if (stack === null || stack === undefined) {
        throw new UnitCommandError('ITEM_SLOT_EMPTY', `Unit "${unit.id}" has no item in slot ${slotIndex}`);
    }
    const item = context.itemsById.get(stack.itemId);
    if (item === undefined) {
        throw new UnitCommandError('ITEM_NOT_FOUND', `Item "${stack.itemId}" is not defined`);
    }
    return item;
}

function acted(unit: CommandUnit): CommandUnit {
    return { ...unit, hasActed: true };
}

function replaceUnits(
    context: UnitCommandContext,
    command: UnitCommandName,
    replacements: ReadonlyMap<string, CommandUnit>,
    convoy: Convoy | undefined = context.convoy
): UnitCommandResult {
    const units = new Map(context.units);
    for (const [id, unit] of replacements) {
        units.set(id, unit);
    }
    return { command, units, convoy };
}
