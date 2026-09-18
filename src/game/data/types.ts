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

export interface UnitStats {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    luck: number;
}

export interface WeaponData {
    id: string;
    name: string;
    might: number;
    hit: number;
    crit: number;
    minRange: number;
    maxRange: number;
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
    stats: UnitStats;
    weapon: WeaponData;
}
