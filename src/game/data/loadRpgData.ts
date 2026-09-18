import type { RpgDataFile } from './rpgData.ts';

/** Loads a data-driven RPG progression/inventory dataset (classes + items) from a JSON URL. */
export async function loadRpgData(path: string): Promise<RpgDataFile> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load RPG data: ${response.status}`);
    }

    return response.json() as Promise<RpgDataFile>;
}
