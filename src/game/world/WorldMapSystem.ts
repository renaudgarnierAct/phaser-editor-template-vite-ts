import type { UnlockCondition, WorldMapData, WorldNodeData, WorldProgressState } from './types.ts';
import {
    AmbiguousChapterSelectionError,
    ChapterNotAvailableError,
    NoAvailableChapterError,
    UnknownNodeError
} from './errors.ts';

/** Creates a fresh progress state starting at the map's declared start node, nothing completed. */
export function createInitialProgress(map: WorldMapData): WorldProgressState {
    return {
        completedChapterIds: [],
        flags: {},
        currentNodeId: map.startNodeId
    };
}

function getNode(map: WorldMapData, nodeId: string): WorldNodeData {
    const node = map.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
        throw new UnknownNodeError(nodeId);
    }
    return node;
}

/** Evaluates a node's unlock condition against the player's current progress. Pure and recursive. */
export function isConditionMet(condition: UnlockCondition, progress: WorldProgressState): boolean {
    switch (condition.type) {
        case 'always':
            return true;
        case 'chapterCompleted':
            return progress.completedChapterIds.includes(condition.chapterId);
        case 'flag':
            return (progress.flags[condition.flag] ?? false) === (condition.equals ?? true);
        case 'allOf':
            return condition.conditions.every((child) => isConditionMet(child, progress));
        case 'anyOf':
            return condition.conditions.some((child) => isConditionMet(child, progress));
        default: {
            const exhaustiveCheck: never = condition;
            throw new Error(`Unknown unlock condition type: ${JSON.stringify(exhaustiveCheck)}`);
        }
    }
}

/** Returns true if `node` is currently unlocked for the given progress. */
export function isNodeUnlocked(node: WorldNodeData, progress: WorldProgressState): boolean {
    return isConditionMet(node.unlock, progress);
}

/**
 * Returns the nodes directly reachable from the player's current node (per `progress.currentNodeId`)
 * that are also unlocked. This is the candidate set for the next chapter to play.
 */
export function getAvailableNextNodes(map: WorldMapData, progress: WorldProgressState): WorldNodeData[] {
    const current = getNode(map, progress.currentNodeId);
    return current.connections
        .map((connectionId) => getNode(map, connectionId))
        .filter((node) => isNodeUnlocked(node, progress));
}

/**
 * Selects the next chapter to play.
 *
 * - If `nodeId` is provided, it must be one of the currently available next nodes, otherwise
 *   {@link ChapterNotAvailableError} is thrown (or {@link UnknownNodeError} if it doesn't exist).
 * - If `nodeId` is omitted, the single available node is returned automatically;
 *   {@link AmbiguousChapterSelectionError} is thrown when several are available and
 *   {@link NoAvailableChapterError} when none are.
 */
export function selectNextChapter(map: WorldMapData, progress: WorldProgressState, nodeId?: string): WorldNodeData {
    const available = getAvailableNextNodes(map, progress);

    if (nodeId !== undefined) {
        const requested = getNode(map, nodeId);
        if (!available.some((node) => node.id === nodeId)) {
            throw new ChapterNotAvailableError(nodeId);
        }
        return requested;
    }

    if (available.length === 0) {
        throw new NoAvailableChapterError(progress.currentNodeId);
    }
    if (available.length > 1) {
        throw new AmbiguousChapterSelectionError(available.map((node) => node.id));
    }
    return available[0];
}

/**
 * Applies the result of completing a chapter: marks its chapter id as completed (idempotent) and
 * moves the player's current node to `arrivedAtNodeId`. Pure function, returns a new state.
 */
export function completeChapter(
    map: WorldMapData,
    progress: WorldProgressState,
    chapterId: string,
    arrivedAtNodeId: string
): WorldProgressState {
    getNode(map, arrivedAtNodeId);

    const completedChapterIds = progress.completedChapterIds.includes(chapterId)
        ? progress.completedChapterIds
        : [...progress.completedChapterIds, chapterId];

    return {
        ...progress,
        completedChapterIds,
        currentNodeId: arrivedAtNodeId
    };
}

/** Sets a named progress flag (e.g. a side-quest outcome). Pure function, returns a new state. */
export function setFlag(progress: WorldProgressState, flag: string, value = true): WorldProgressState {
    return { ...progress, flags: { ...progress.flags, [flag]: value } };
}
