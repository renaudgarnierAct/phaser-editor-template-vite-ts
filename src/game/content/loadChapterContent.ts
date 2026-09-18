import type { ChapterData } from '../data/types.ts';
import type { EventScript } from '../events/types.ts';
import type { ChapterContent, ChapterHookPhase, ChapterManifest, DialogueCatalog } from './types.ts';
import { loadDialogueCatalog, resolveDialogueRefs, validateDialogueCatalog } from './dialogueCatalog.ts';
import { mergeEventScripts, validateChapterData, validateChapterManifest, validateHookScripts } from './validate.ts';
import { UnknownDialogueRefError } from './errors.ts';

const EMPTY_SCRIPT_ID_SUFFIX: Record<ChapterHookPhase, string> = {
    preChapter: 'pre-chapter',
    duringChapter: 'during-chapter',
    postChapter: 'post-chapter'
};

async function fetchJson<T>(path: string, kind: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Unable to load ${kind}: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

async function loadHookScript(manifest: ChapterManifest, phase: ChapterHookPhase): Promise<EventScript> {
    const ref = manifest.hooks[phase];
    if (ref === undefined) {
        return { id: `events:${manifest.id}:${EMPTY_SCRIPT_ID_SUFFIX[phase]}`, events: [] };
    }
    return fetchJson<EventScript>(ref, `${phase} hook script`);
}

/**
 * Loads a fully self-contained, chainable chapter from its manifest: the chapter data (map + units),
 * an optional dialogue catalog, and the three generic hook scripts (preChapter/duringChapter/postChapter).
 * Every `dialogue` action using a `dialogueRef` is resolved against the catalog, unit references in
 * hook triggers/actions are validated against the chapter roster, and all hooks are merged into a
 * single `combinedScript` ready to feed an `EventEngine`.
 */
export async function loadChapterContent(manifestPath: string): Promise<ChapterContent> {
    const manifest = await fetchJson<ChapterManifest>(manifestPath, 'chapter manifest');
    validateChapterManifest(manifest);

    const [chapter, dialogueCatalog, preChapter, duringChapter, postChapter] = await Promise.all([
        fetchJson<ChapterData>(manifest.chapterDataRef, 'chapter data'),
        manifest.dialogueCatalogRef ? loadDialogueCatalog(manifest.dialogueCatalogRef) : Promise.resolve(undefined),
        loadHookScript(manifest, 'preChapter'),
        loadHookScript(manifest, 'duringChapter'),
        loadHookScript(manifest, 'postChapter')
    ]);

    return buildChapterContent(manifest, chapter, dialogueCatalog, { preChapter, duringChapter, postChapter });
}

/** Pure assembly step, split out from I/O so it can be exercised directly with in-memory fixtures. */
export function buildChapterContent(
    manifest: ChapterManifest,
    chapter: ChapterData,
    dialogueCatalog: DialogueCatalog | undefined,
    hooks: Record<ChapterHookPhase, EventScript>
): ChapterContent {
    validateChapterManifest(manifest);
    validateChapterData(chapter, manifest.id);
    if (dialogueCatalog !== undefined) {
        validateDialogueCatalog(dialogueCatalog);
    }

    const scripts = [hooks.preChapter, hooks.duringChapter, hooks.postChapter];
    validateHookScripts(chapter, scripts);
    if (dialogueCatalog === undefined) {
        for (const script of scripts) {
            for (const event of script.events) {
                for (const action of event.actions) {
                    const dialogueRef = (action as unknown as Record<string, unknown>).dialogueRef;
                    if (action.type === 'dialogue' && typeof dialogueRef === 'string') {
                        throw new UnknownDialogueRefError(dialogueRef);
                    }
                }
            }
        }
    }

    const resolvedHooks: Record<ChapterHookPhase, EventScript> = dialogueCatalog
        ? {
              preChapter: resolveDialogueRefs(hooks.preChapter, dialogueCatalog),
              duringChapter: resolveDialogueRefs(hooks.duringChapter, dialogueCatalog),
              postChapter: resolveDialogueRefs(hooks.postChapter, dialogueCatalog)
          }
        : hooks;

    const combinedScript = mergeEventScripts(`events:${manifest.id}:combined`, [
        resolvedHooks.preChapter,
        resolvedHooks.duringChapter,
        resolvedHooks.postChapter
    ]);

    return {
        id: manifest.id,
        name: manifest.name,
        chapter,
        dialogueCatalog,
        hooks: resolvedHooks,
        combinedScript
    };
}
