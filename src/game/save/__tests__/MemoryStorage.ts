import type { StorageLike } from '../types.ts';

/** Minimal in-memory {@link StorageLike} implementation for tests, mirroring `localStorage` semantics. */
export class MemoryStorage implements StorageLike {
    private readonly map = new Map<string, string>();

    getItem(key: string): string | null {
        return this.map.has(key) ? this.map.get(key)! : null;
    }

    setItem(key: string, value: string): void {
        this.map.set(key, value);
    }

    removeItem(key: string): void {
        this.map.delete(key);
    }

    key(index: number): string | null {
        return [...this.map.keys()][index] ?? null;
    }

    get length(): number {
        return this.map.size;
    }
}
