import type { ChapterData } from '../data/types.ts';
import type { EventScript } from '../events/types.ts';

/** One reusable line of dialogue, kept as a placeholder so content authors can plug real text later. */
export interface DialogueCatalogEntry {
    id: string;
    speaker?: string;
    lines: string[];
}

/** A named collection of {@link DialogueCatalogEntry} looked up by id via `dialogueRef`. */
export interface DialogueCatalog {
    id: string;
    entries: DialogueCatalogEntry[];
}

/** The three generic hook points a chainable, self-contained chapter can declare events under. */
export type ChapterHookPhase = 'preChapter' | 'duringChapter' | 'postChapter';

/** Points to the JSON documents that make up one autonomous, chainable chapter. */
export interface ChapterManifest {
    id: string;
    name: string;
    /** Path to a {@link ChapterData} JSON document (map + units). */
    chapterDataRef: string;
    /** Optional path to a {@link DialogueCatalog} JSON document. */
    dialogueCatalogRef?: string;
    hooks: {
        /** Fires once, before the chapter proper starts (e.g. on `chapter_start`). */
        preChapter?: string;
        /** Fires while the chapter is being played, driven by any generic trigger (house, village, recruitment, boss_dead, ...). */
        duringChapter?: string;
        /** Fires once the chapter has concluded (e.g. on a `variable_change` for the chapter outcome). */
        postChapter?: string;
    };
}

/** Fully resolved chapter content: chapter data, optional dialogue catalog, and per-phase event scripts. */
export interface ChapterContent {
    id: string;
    name: string;
    chapter: ChapterData;
    dialogueCatalog?: DialogueCatalog;
    hooks: Record<ChapterHookPhase, EventScript>;
    /** All hook scripts merged into one, in preChapter -> duringChapter -> postChapter order, ready for `EventEngine.loadScript`. */
    combinedScript: EventScript;
}
