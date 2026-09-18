/**
 * Data-driven unlock condition for a world map node. Conditions are evaluated against a
 * {@link WorldProgressState} snapshot and never touch game systems directly.
 */
export type UnlockCondition =
    | { type: 'always' }
    | { type: 'chapterCompleted'; chapterId: string }
    | { type: 'flag'; flag: string; equals?: boolean }
    | { type: 'allOf'; conditions: UnlockCondition[] }
    | { type: 'anyOf'; conditions: UnlockCondition[] };

/** One selectable point on the world map, tied to a playable chapter. */
export interface WorldNodeData {
    id: string;
    chapterId: string;
    name: string;
    x: number;
    y: number;
    /** Ids of nodes reachable directly from this one once their own unlock condition is met. */
    connections: string[];
    unlock: UnlockCondition;
}

/** The full, static world map definition, typically loaded from `public/data/world-map.json`. */
export interface WorldMapData {
    id: string;
    name: string;
    startNodeId: string;
    nodes: WorldNodeData[];
}

/** Mutable player progress against a world map: pure data, safe to persist via the save system. */
export interface WorldProgressState {
    /** Ids of chapters the player has already completed. */
    completedChapterIds: string[];
    /** Arbitrary named flags set by chapters/events (e.g. side-quest outcomes). */
    flags: Record<string, boolean>;
    /** Id of the node the player is currently standing on. */
    currentNodeId: string;
}
