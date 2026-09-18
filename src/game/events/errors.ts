export class EventEngineError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EventEngineError';
    }
}

export class DuplicateEventIdError extends EventEngineError {
    constructor(id: string) {
        super(`Duplicate event id: "${id}"`);
        this.name = 'DuplicateEventIdError';
    }
}

export class UnknownActionHandlerError extends EventEngineError {
    constructor(actionType: string) {
        super(`No handler registered for action type: "${actionType}"`);
        this.name = 'UnknownActionHandlerError';
    }
}

export class ActionValidationError extends EventEngineError {
    constructor(actionType: string, message: string) {
        super(`Invalid "${actionType}" action: ${message}`);
        this.name = 'ActionValidationError';
    }
}

export class InvalidConditionError extends EventEngineError {
    constructor(message: string) {
        super(`Invalid condition: ${message}`);
        this.name = 'InvalidConditionError';
    }
}

export class UnknownVariableScopeError extends EventEngineError {
    constructor(scope: string) {
        super(`Unknown variable scope: "${scope}"`);
        this.name = 'UnknownVariableScopeError';
    }
}
