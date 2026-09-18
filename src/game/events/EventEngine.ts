import type { GameEvent, EventScript, Trigger, VariableScope } from './types.ts';
import { VariableStore } from './VariableStore.ts';
import { evaluateCondition } from './conditions.ts';
import { ActionRegistry, createDefaultActionRegistry } from './actions.ts';
import type { ActionEffect } from './actions.ts';
import { DuplicateEventIdError, EventEngineError } from './errors.ts';

export interface EventFiredResult {
    eventId: string;
    trigger: Trigger;
    effects: ActionEffect[];
}

export interface EventEngineOptions {
    variables?: VariableStore;
    actionRegistry?: ActionRegistry;
    /** Guards against infinite variable_change cascades (a set_variable action re-triggering itself). */
    maxCascadeDepth?: number;
}

/**
 * Generic, data-driven event engine: register GameEvent definitions (trigger + optional
 * condition + actions), then call `dispatch` whenever something happens in the game
 * (a chapter starts, a turn begins, a unit dies, ...). Matching, non-fired, condition-satisfying
 * events run their actions in declaration order. The engine has no dependency on Phaser or on the
 * combat system: it only manipulates plain data and calls into the ActionRegistry.
 */
export class EventEngine {
    readonly variables: VariableStore;
    readonly actions: ActionRegistry;

    private readonly events = new Map<string, GameEvent>();
    private readonly triggerIndex = new Map<Trigger['type'], GameEvent[]>();
    private readonly firedOnce = new Set<string>();
    private readonly maxCascadeDepth: number;
    private cascadeDepth = 0;

    constructor(options: EventEngineOptions = {}) {
        this.variables = options.variables ?? new VariableStore();
        this.actions = options.actionRegistry ?? createDefaultActionRegistry();
        this.maxCascadeDepth = options.maxCascadeDepth ?? 8;

        this.variables.onChange((scope, key) => {
            this.handleVariableChange(scope, key);
        });
    }

    loadScript(script: EventScript): void {
        for (const event of script.events) {
            this.addEvent(event);
        }
    }

    addEvent(event: GameEvent): void {
        if (this.events.has(event.id)) {
            throw new DuplicateEventIdError(event.id);
        }

        this.events.set(event.id, event);

        const bucket = this.triggerIndex.get(event.trigger.type) ?? [];
        bucket.push(event);
        this.triggerIndex.set(event.trigger.type, bucket);
    }

    hasFired(eventId: string): boolean {
        return this.firedOnce.has(eventId);
    }

    /** Clears "fired once" bookkeeping for events, without touching registered events or variables. */
    resetFiredState(): void {
        this.firedOnce.clear();
    }

    /**
     * Matches `trigger` against every registered event whose trigger type and payload match,
     * evaluates their condition (if any), and runs the actions of every event that qualifies.
     * Returns one EventFiredResult per event that actually fired, in registration order.
     */
    dispatch(trigger: Trigger): EventFiredResult[] {
        const candidates = this.triggerIndex.get(trigger.type) ?? [];
        const results: EventFiredResult[] = [];

        for (const event of candidates) {
            if (!this.matchesTrigger(event.trigger, trigger)) {
                continue;
            }

            const once = event.once ?? true;
            if (once && this.firedOnce.has(event.id)) {
                continue;
            }

            if (event.condition !== undefined && !evaluateCondition(event.condition, this.variables)) {
                continue;
            }

            const effects = this.runActions(event);
            if (once) {
                this.firedOnce.add(event.id);
            }

            results.push({ eventId: event.id, trigger, effects });
        }

        return results;
    }

    private runActions(event: GameEvent): ActionEffect[] {
        const effects: ActionEffect[] = [];
        for (const action of event.actions) {
            effects.push(this.actions.execute(action, { variables: this.variables, eventId: event.id }));
        }

        return effects;
    }

    private handleVariableChange(scope: VariableScope, key: string): void {
        if (this.cascadeDepth >= this.maxCascadeDepth) {
            throw new EventEngineError(
                `Variable change cascade exceeded max depth (${this.maxCascadeDepth}) while updating "${scope}.${key}"`
            );
        }

        this.cascadeDepth += 1;
        try {
            this.dispatch({ type: 'variable_change', variable: { scope, key } });
        } finally {
            this.cascadeDepth -= 1;
        }
    }

    private matchesTrigger(defined: Trigger, incoming: Trigger): boolean {
        switch (defined.type) {
            case 'chapter_start':
                return incoming.type === 'chapter_start';
            case 'turn':
                return incoming.type === 'turn'
                    && defined.turn === incoming.turn
                    && (defined.faction === undefined || defined.faction === incoming.faction);
            case 'unit_dead':
                return incoming.type === 'unit_dead' && defined.unitId === incoming.unitId;
            case 'boss_dead':
                return incoming.type === 'boss_dead'
                    && (defined.unitId === undefined || defined.unitId === incoming.unitId);
            case 'arrival':
                return incoming.type === 'arrival'
                    && defined.x === incoming.x
                    && defined.y === incoming.y
                    && (defined.unitId === undefined || defined.unitId === incoming.unitId);
            case 'house':
                return incoming.type === 'house' && defined.houseId === incoming.houseId;
            case 'village':
                return incoming.type === 'village' && defined.villageId === incoming.villageId;
            case 'recruitment':
                return incoming.type === 'recruitment' && defined.unitId === incoming.unitId;
            case 'variable_change':
                return incoming.type === 'variable_change'
                    && defined.variable.scope === incoming.variable.scope
                    && defined.variable.key === incoming.variable.key;
            default: {
                const exhaustive: never = defined;
                throw new EventEngineError(`Unknown trigger type: ${JSON.stringify(exhaustive)}`);
            }
        }
    }
}
