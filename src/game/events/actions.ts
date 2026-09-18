import type {
    DialogueAction,
    EndChapterAction,
    EventAction,
    GiveItemAction,
    RecruitAction,
    SetVariableAction,
    SpawnAction,
    VariableRef,
    VariableScope
} from './types';
import type { VariableStore } from './VariableStore';
import { ActionValidationError, UnknownActionHandlerError } from './errors';

export interface ActionContext {
    variables: VariableStore;
    eventId: string;
}

/** Describes an action that was executed, so any consumer (UI, combat system, tests) can react to it. */
export interface ActionEffect {
    eventId: string;
    action: EventAction;
}

export type ActionHandler<A extends EventAction = EventAction> = (
    action: A,
    context: ActionContext
) => void;

/**
 * Registry mapping an action `type` string to the handler that performs it.
 * Built-in handlers cover dialogue/set_variable/recruit/give_item/spawn/end_chapter;
 * consumers may register additional handlers, or override a built-in one, at runtime.
 */
export class ActionRegistry {
    private readonly handlers = new Map<string, ActionHandler>();

    register<A extends EventAction>(type: string, handler: ActionHandler<A>): void {
        this.handlers.set(type, handler as ActionHandler);
    }

    has(type: string): boolean {
        return this.handlers.has(type);
    }

    execute(action: EventAction, context: ActionContext): ActionEffect {
        const handler = this.handlers.get(action.type);
        if (handler === undefined) {
            throw new UnknownActionHandlerError(action.type);
        }

        handler(action, context);
        return { eventId: context.eventId, action };
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Views an EventAction as a plain record so payload fields can be validated before narrowing. */
function toRecord(action: EventAction): Record<string, unknown> {
    return action as unknown as Record<string, unknown>;
}

function assertVariableRef(actionType: string, value: unknown): asserts value is VariableRef {
    if (!isRecord(value) || typeof value.key !== 'string' || !isVariableScope(value.scope)) {
        throw new ActionValidationError(actionType, '"variable" must be an object with a valid "scope" and a string "key"');
    }
}

function isVariableScope(value: unknown): value is VariableScope {
    return value === 'chapter' || value === 'campaign' || value === 'global';
}

function validateDialogue(action: EventAction): asserts action is DialogueAction {
    const { lines, speaker } = toRecord(action);
    if (!Array.isArray(lines) || lines.length === 0 || lines.some((line) => typeof line !== 'string')) {
        throw new ActionValidationError('dialogue', '"lines" must be a non-empty array of strings');
    }

    if (speaker !== undefined && typeof speaker !== 'string') {
        throw new ActionValidationError('dialogue', '"speaker" must be a string when provided');
    }
}

function validateSetVariable(action: EventAction): asserts action is SetVariableAction {
    const { variable, value } = toRecord(action);
    assertVariableRef('set_variable', variable);

    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new ActionValidationError('set_variable', '"value" must be a string, number or boolean');
    }
}

function validateRecruit(action: EventAction): asserts action is RecruitAction {
    const { unitId } = toRecord(action);
    if (typeof unitId !== 'string' || unitId.length === 0) {
        throw new ActionValidationError('recruit', '"unitId" must be a non-empty string');
    }
}

function validateGiveItem(action: EventAction): asserts action is GiveItemAction {
    const { unitId, itemId, quantity } = toRecord(action);
    if (typeof unitId !== 'string' || unitId.length === 0) {
        throw new ActionValidationError('give_item', '"unitId" must be a non-empty string');
    }

    if (typeof itemId !== 'string' || itemId.length === 0) {
        throw new ActionValidationError('give_item', '"itemId" must be a non-empty string');
    }

    if (quantity !== undefined && (typeof quantity !== 'number' || quantity <= 0)) {
        throw new ActionValidationError('give_item', '"quantity" must be a positive number when provided');
    }
}

function validateSpawn(action: EventAction): asserts action is SpawnAction {
    const { unitId, classId, faction, x, y } = toRecord(action);
    if (typeof unitId !== 'string' || unitId.length === 0) {
        throw new ActionValidationError('spawn', '"unitId" must be a non-empty string');
    }

    if (typeof classId !== 'string' || classId.length === 0) {
        throw new ActionValidationError('spawn', '"classId" must be a non-empty string');
    }

    if (faction !== 'player' && faction !== 'enemy') {
        throw new ActionValidationError('spawn', '"faction" must be "player" or "enemy"');
    }

    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new ActionValidationError('spawn', '"x" and "y" must be numbers');
    }
}

function validateEndChapter(action: EventAction): asserts action is EndChapterAction {
    const { outcome } = toRecord(action);
    if (outcome !== 'victory' && outcome !== 'defeat') {
        throw new ActionValidationError('end_chapter', '"outcome" must be "victory" or "defeat"');
    }
}

/**
 * Builds an ActionRegistry with the built-in action handlers wired up.
 * - `set_variable` mutates the VariableStore directly (deterministic, immediate).
 * - The other built-ins (dialogue, recruit, give_item, spawn, end_chapter) are intentionally
 *   decoupled from any rendering/combat system: they only validate their payload. Consumers that
 *   need real side effects (opening a dialogue box, moving a sprite, ending the scene, ...) should
 *   register their own handler for that action type, overriding the built-in with `register`.
 */
export function createDefaultActionRegistry(): ActionRegistry {
    const registry = new ActionRegistry();

    registry.register<DialogueAction>('dialogue', (action) => {
        validateDialogue(action);
    });

    registry.register<SetVariableAction>('set_variable', (action, context) => {
        validateSetVariable(action);
        context.variables.set(action.variable.scope, action.variable.key, action.value);
    });

    registry.register<RecruitAction>('recruit', (action) => {
        validateRecruit(action);
    });

    registry.register<GiveItemAction>('give_item', (action) => {
        validateGiveItem(action);
    });

    registry.register<SpawnAction>('spawn', (action) => {
        validateSpawn(action);
    });

    registry.register<EndChapterAction>('end_chapter', (action) => {
        validateEndChapter(action);
    });

    return registry;
}
