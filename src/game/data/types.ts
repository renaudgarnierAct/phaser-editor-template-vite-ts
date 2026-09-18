export type Faction = 'player' | 'enemy';

export interface TerrainDefinition {
    name: string;
    moveCost: number;
    defense: number;
    avoid: number;
    color: number;
}

export interface ChapterData {
    id: string;
    name: string;
    map: {
        width: number;
        height: number;
        tiles: string[];
        terrainLegend: Record<string, string>;
    };
    terrain: Record<string, TerrainDefinition>;
    units: UnitData[];
}

export interface UnitData {
    id: string;
    name: string;
    faction: Faction;
    classId: string;
    x: number;
    y: number;
    movement: number;
    color: number;
}
