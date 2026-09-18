import type { ClassDefinition } from './classes.ts';
import type { ItemDefinition } from './items.ts';

/** A full data-driven RPG progression/inventory dataset, as loaded from JSON. */
export interface RpgDataFile {
    classes: ClassDefinition[];
    items: ItemDefinition[];
}

/** Indexes an {@link RpgDataFile} by id for O(1) lookups. */
export interface RpgDataIndex {
    classesById: Map<string, ClassDefinition>;
    itemsById: Map<string, ItemDefinition>;
}

export function indexRpgData(data: RpgDataFile): RpgDataIndex {
    return {
        classesById: new Map(data.classes.map((definition) => [definition.id, definition])),
        itemsById: new Map(data.items.map((definition) => [definition.id, definition]))
    };
}
