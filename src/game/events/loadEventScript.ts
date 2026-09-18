import type { EventScript } from './types';

/** Fetches and parses an EventScript JSON file (e.g. from `public/data/`). No schema validation is performed here. */
export async function loadEventScript(path: string): Promise<EventScript> {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load event script: ${response.status}`);
    }

    return response.json() as Promise<EventScript>;
}
