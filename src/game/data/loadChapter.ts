import type { ChapterData } from './types';

export async function loadChapter(path: string): Promise<ChapterData> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load chapter data: ${response.status}`);
    }

    return response.json() as Promise<ChapterData>;
}
