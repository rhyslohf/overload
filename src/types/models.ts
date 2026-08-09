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

export interface SetDefinition {
  id: string;
  order: number;
  targetReps?: number;
  targetRepsMax?: number; // optional top of range, for double progression
  toFailure: boolean;
  weightMode: 'absolute' | 'percentageOfSet';
  targetWeightKg?: number; // when weightMode = 'absolute'
  percentageOf?: { sourceSetId: string; percent: number }; // when weightMode = 'percentageOfSet'
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
}

export interface LoggedSet {
  id: string;
  setDefId: string;
  order: number;
  weightKg: number;
  reps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  myorepMiniSets?: { reps: number }[]; // weight = this set's weightKg
  completedAt: string;
}

export interface ExerciseEntry {
  id: string;
  name: string;
}

export type Difficulty = LoggedSet['difficulty'];

export const SCHEMA_VERSION = 1 as const;
