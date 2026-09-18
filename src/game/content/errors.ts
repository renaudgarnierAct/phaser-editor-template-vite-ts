export class ChapterContentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChapterContentError';
    }
}

export class InvalidDialogueCatalogError extends ChapterContentError {
    constructor(message: string) {
        super(`Invalid dialogue catalog: ${message}`);
        this.name = 'InvalidDialogueCatalogError';
    }
}

export class UnknownDialogueRefError extends ChapterContentError {
    constructor(dialogueRef: string) {
        super(`Unknown dialogueRef: "${dialogueRef}"`);
        this.name = 'UnknownDialogueRefError';
    }
}

export class InvalidChapterManifestError extends ChapterContentError {
    constructor(message: string) {
        super(`Invalid chapter manifest: ${message}`);
        this.name = 'InvalidChapterManifestError';
    }
}

export class InvalidChapterDataError extends ChapterContentError {
    constructor(message: string) {
        super(`Invalid chapter data: ${message}`);
        this.name = 'InvalidChapterDataError';
    }
}

export class InvalidHookScriptError extends ChapterContentError {
    constructor(message: string) {
        super(`Invalid chapter hook script: ${message}`);
        this.name = 'InvalidHookScriptError';
    }
}

export class DuplicateHookEventIdError extends ChapterContentError {
    constructor(id: string) {
        super(`Duplicate event id across chapter hooks: "${id}"`);
        this.name = 'DuplicateHookEventIdError';
    }
}
