export class WorldMapError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorldMapError';
    }
}

/** Thrown when a world map's node graph is structurally invalid (bad ids, dangling links, ...). */
export class InvalidWorldMapError extends WorldMapError {
    constructor(message: string) {
        super(`Invalid world map: ${message}`);
        this.name = 'InvalidWorldMapError';
    }
}

/** Thrown when a node id does not exist on the world map. */
export class UnknownNodeError extends WorldMapError {
    constructor(nodeId: string) {
        super(`Unknown world map node: "${nodeId}"`);
        this.name = 'UnknownNodeError';
    }
}

/** Thrown when selecting a chapter that is not currently reachable/unlocked from the player's position. */
export class ChapterNotAvailableError extends WorldMapError {
    constructor(nodeId: string) {
        super(`Chapter node "${nodeId}" is not available from the current position`);
        this.name = 'ChapterNotAvailableError';
    }
}

/** Thrown by automatic chapter selection when more than one node is available and none was chosen explicitly. */
export class AmbiguousChapterSelectionError extends WorldMapError {
    constructor(nodeIds: string[]) {
        super(`Multiple chapters are available, an explicit nodeId is required: ${nodeIds.join(', ')}`);
        this.name = 'AmbiguousChapterSelectionError';
    }
}

/** Thrown by automatic chapter selection when no node is currently reachable. */
export class NoAvailableChapterError extends WorldMapError {
    constructor(nodeId: string) {
        super(`No unlocked chapter is reachable from node "${nodeId}"`);
        this.name = 'NoAvailableChapterError';
    }
}
