/**
 * Data model — mirrors REQUIREMENTS.md §6 exactly.
 *
 * Weight is stored internally in one canonical unit (`weightKg`) regardless
 * of the display unit, so percentage math and progression suggestions stay
 * correct even if the display unit is switched later.
 *
 * WorkoutSession/LoggedSet are the immutable "fact table"; Routine/Exercise
 * are snapshotted dimensions (squash at time-of-use) so editing or deleting
 * a routine later can't corrupt history.
 */

export interface Routine {
  id: string;
  schemaVersion: 1;
  name: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  exercises: RoutineExercise[];
}

export interface RoutineExercise {
  id: string;
  exerciseId: string; // stable ref into the exercise library
  name: string; // snapshot, so a later rename doesn't rewrite history
  order: number;
  sets: SetDefinition[];
}

export type WeightMode = 'absolute' | 'bodyweight' | 'percentageOfSet';

export interface SetDefinition {
  id: string;
  order: number;
  targetReps?: number;
  targetRepsMax?: number; // optional top of range, for double progression
  toFailure: boolean;
  weightMode: WeightMode;
  targetWeightKg?: number; // when weightMode = 'absolute'
  percentageOf?: { sourceSetId: string; percent: number }; // when weightMode = 'percentageOfSet'
  // §11.2: bodyweight exercises (pull-ups, dips, …) — weight optional, the
  // "+ added weight" field carries belt/plate load (0 / undefined = pure BW).
  bodyweight?: { addedWeightKg?: number };
  isMyorep: boolean;
  myorep?: {
    activationRepTarget?: number;
    miniSetRepTarget?: number;
    miniSetRestSeconds?: number;
    maxMiniSets?: number;
    stopBelowReps?: number;
  };
  isWarmup?: boolean; // excluded from progression suggestions
  targetRestSeconds?: number;
}

export interface WorkoutSession {
  id: string;
  schemaVersion: 1;
  routineId: string;
  routineName: string; // snapshot
  startedAt: string;
  completedAt?: string;
  status: 'inProgress' | 'completed' | 'abandoned';
  exercises: LoggedExercise[];
}

export interface LoggedExercise {
  id: string;
  exerciseId: string;
  name: string;
  order: number;
  sets: LoggedSet[];
  // §4.2 "skip a planned one": setDefIds deliberately not performed this session.
  skippedSetDefIds?: string[];
}

export interface LoggedSet {
  id: string;
  setDefId: string;
  order: number;
  weightKg: number;
  reps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  // §11.2: pure bodyweight / added-weight — weightKg is the added load
  // (0 = pure bodyweight), flagged so history renders "Bodyweight".
  isBodyweight?: boolean;
  myorepMiniSets?: { reps: number }[]; // weight = this set's weightKg
  completedAt: string;
}

export interface ExerciseEntry {
  id: string;
  name: string;
}

export type Difficulty = LoggedSet['difficulty'];

export const SCHEMA_VERSION = 1 as const;
