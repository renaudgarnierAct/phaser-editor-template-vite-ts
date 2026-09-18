import type { Condition, VariableCondition } from './types';
import type { VariableStore } from './VariableStore';
import { InvalidConditionError } from './errors';

/** Evaluates a (possibly nested) condition tree against the current variable state. Pure and deterministic. */
export function evaluateCondition(condition: Condition, variables: VariableStore): boolean {
    switch (condition.kind) {
        case 'all':
            return condition.conditions.every((child) => evaluateCondition(child, variables));
        case 'any':
            return condition.conditions.some((child) => evaluateCondition(child, variables));
        case 'not':
            return !evaluateCondition(condition.condition, variables);
        case 'variable':
            return evaluateVariableCondition(condition, variables);
        default: {
            const exhaustive: never = condition;
            throw new InvalidConditionError(`Unknown condition kind: ${JSON.stringify(exhaustive)}`);
        }
    }
}

function evaluateVariableCondition(condition: VariableCondition, variables: VariableStore): boolean {
    const current = variables.get(condition.variable.scope, condition.variable.key);

    switch (condition.operator) {
        case 'eq':
            return current === condition.value;
        case 'neq':
            return current !== condition.value;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
            return compareNumbers(condition.operator, current, condition.value);
        default: {
            const exhaustive: never = condition.operator;
            throw new InvalidConditionError(`Unknown operator: ${JSON.stringify(exhaustive)}`);
        }
    }
}

function compareNumbers(
    operator: 'gt' | 'gte' | 'lt' | 'lte',
    current: unknown,
    expected: unknown
): boolean {
    if (typeof current !== 'number' || typeof expected !== 'number') {
        throw new InvalidConditionError(
            `Operator "${operator}" requires numeric values, got "${typeof current}" and "${typeof expected}"`
        );
    }

    switch (operator) {
        case 'gt':
            return current > expected;
        case 'gte':
            return current >= expected;
        case 'lt':
            return current < expected;
        case 'lte':
            return current <= expected;
    }
}
