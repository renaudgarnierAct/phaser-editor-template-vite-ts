import type { WorldNodeData } from './types.ts';

export interface ChapterLaunchData {
    chapterId: string;
    worldNodeId: string;
}

/** Builds the stable scene payload used to launch a chapter selected on the world map. */
export function createChapterLaunchData(node: WorldNodeData): ChapterLaunchData {
    return {
        chapterId: node.chapterId,
        worldNodeId: node.id
    };
}
