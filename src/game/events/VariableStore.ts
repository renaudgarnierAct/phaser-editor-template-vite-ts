import type { VariableScope, VariableValue } from './types';
import { UnknownVariableScopeError } from './errors';

export type VariableChangeListener = (
    scope: VariableScope,
    key: string,
    value: VariableValue,
    previous: VariableValue | undefined
) => void;

/**
 * Holds variables in three independent scopes:
 *  - chapter: reset when a new chapter starts (progress flags local to a map).
 *  - campaign: persists across chapters within a playthrough.
 *  - global: persists across playthroughs (unlocks, settings, meta-progress).
 */
export class VariableStore {
    private readonly scopes: Record<VariableScope, Map<string, VariableValue>> = {
        chapter: new Map(),
        campaign: new Map(),
        global: new Map()
    };

    private readonly listeners = new Set<VariableChangeListener>();

    constructor(initial?: Partial<Record<VariableScope, Record<string, VariableValue>>>) {
        if (initial === undefined) {
            return;
        }

        for (const scope of Object.keys(initial) as VariableScope[]) {
            const values = initial[scope];
            if (values === undefined) {
                continue;
            }

            for (const [key, value] of Object.entries(values)) {
                this.map(scope).set(key, value);
            }
        }
    }

    get(scope: VariableScope, key: string): VariableValue | undefined {
        return this.map(scope).get(key);
    }

    /** Same as `get`, but throws when the variable has never been set. */
    getRequired(scope: VariableScope, key: string): VariableValue {
        const value = this.map(scope).get(key);
        if (value === undefined) {
            throw new UnknownVariableScopeError(`${scope}.${key}`);
        }

        return value;
    }

    set(scope: VariableScope, key: string, value: VariableValue): void {
        const map = this.map(scope);
        const previous = map.get(key);
        map.set(key, value);

        if (previous !== value) {
            for (const listener of this.listeners) {
                listener(scope, key, value, previous);
            }
        }
    }

    has(scope: VariableScope, key: string): boolean {
        return this.map(scope).has(key);
    }

    /** Registers a listener invoked whenever a variable's value actually changes. Returns an unsubscribe function. */
    onChange(listener: VariableChangeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Clears chapter-scoped variables, typically called right before loading a new chapter. */
    resetChapterScope(): void {
        this.scopes.chapter.clear();
    }

    private map(scope: VariableScope): Map<string, VariableValue> {
        const map = this.scopes[scope];
        if (map === undefined) {
            throw new UnknownVariableScopeError(scope);
        }

        return map;
    }
}
