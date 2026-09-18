export type VariableScope = 'chapter' | 'campaign' | 'global';

export type VariableValue = string | number | boolean;

export interface VariableRef {
    scope: VariableScope;
    key: string;
}

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface VariableCondition {
    kind: 'variable';
    variable: VariableRef;
    operator: ComparisonOperator;
    value: VariableValue;
}

export interface AllCondition {
    kind: 'all';
    conditions: Condition[];
}

export interface AnyCondition {
    kind: 'any';
    conditions: Condition[];
}

export interface NotCondition {
    kind: 'not';
    condition: Condition;
}

// Conditions use "kind" (rather than "type") so they never collide with the
// "type" discriminant used by triggers and actions.
export type Condition = VariableCondition | AllCondition | AnyCondition | NotCondition;

export type Faction = 'player' | 'enemy';

export interface ChapterStartTrigger {
    type: 'chapter_start';
}

export interface TurnTrigger {
    type: 'turn';
    turn: number;
    faction?: Faction;
}

export interface UnitDeadTrigger {
    type: 'unit_dead';
    unitId: string;
}

export interface BossDeadTrigger {
    type: 'boss_dead';
    unitId?: string;
}

export interface ArrivalTrigger {
    type: 'arrival';
    x: number;
    y: number;
    unitId?: string;
}

export interface HouseTrigger {
    type: 'house';
    houseId: string;
}

export interface VillageTrigger {
    type: 'village';
    villageId: string;
}

export interface RecruitmentTrigger {
    type: 'recruitment';
    unitId: string;
}

export interface VariableChangeTrigger {
    type: 'variable_change';
    variable: VariableRef;
}

export type Trigger =
    | ChapterStartTrigger
    | TurnTrigger
    | UnitDeadTrigger
    | BossDeadTrigger
    | ArrivalTrigger
    | HouseTrigger
    | VillageTrigger
    | RecruitmentTrigger
    | VariableChangeTrigger;

export type TriggerType = Trigger['type'];

export interface DialogueAction {
    type: 'dialogue';
    speaker?: string;
    lines: string[];
}

export interface SetVariableAction {
    type: 'set_variable';
    variable: VariableRef;
    value: VariableValue;
}

export interface RecruitAction {
    type: 'recruit';
    unitId: string;
}

export interface GiveItemAction {
    type: 'give_item';
    unitId: string;
    itemId: string;
    quantity?: number;
}

export interface SpawnAction {
    type: 'spawn';
    unitId: string;
    classId: string;
    faction: Faction;
    x: number;
    y: number;
}

export interface EndChapterAction {
    type: 'end_chapter';
    outcome: 'victory' | 'defeat';
}

export type KnownAction =
    | DialogueAction
    | SetVariableAction
    | RecruitAction
    | GiveItemAction
    | SpawnAction
    | EndChapterAction;

// Custom, non-built-in action payloads registered at runtime via ActionRegistry.
export interface CustomAction {
    type: string;
    [key: string]: unknown;
}

export type EventAction = KnownAction | CustomAction;

export interface GameEvent {
    id: string;
    trigger: Trigger;
    condition?: Condition;
    actions: EventAction[];
    /** Defaults to true: the event fires at most once per engine instance. */
    once?: boolean;
}

export interface EventScript {
    id: string;
    events: GameEvent[];
}
