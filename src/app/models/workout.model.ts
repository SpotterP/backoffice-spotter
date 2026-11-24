import type { Exercise } from './exercise.model';
import type { ListParams, PageInfo } from './page.model';

// Los mismos valores que acepta el modelo Workout del backend
export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

// La API solo rellena el id y el nombre del dueño
export interface WorkoutOwner {
  _id: string;
  name: string;
}

// Cada ejercicio de una rutina lleva sus series y repeticiones; el orden del array es el
// orden de la rutina
export interface WorkoutExercise {
  exercise: Exercise;
  sets: number;
  reps: number;
}

// Al crear o editar, los ejercicios se envían como lista de ids con sus series y repeticiones.
// El formulario todavía manda dayOfWeek y una lista de ids: su card lo migra aparte.
export interface WorkoutInput {
  name: string;
  dayOfWeek: DayOfWeek;
  description?: string;
  exercises?: string[];
}

// La rutina tal como la devuelve la API: varios días, dueño y los ejercicios con sus
// series y repeticiones
export interface Workout {
  _id: string;
  name: string;
  description?: string;
  days: DayOfWeek[];
  owner: WorkoutOwner | null;
  exercises: WorkoutExercise[];
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutsPage {
  workouts: Workout[];
  pagination: PageInfo;
}

// La API filtra por day y por owner; el vacío se omite en buildListParams
export interface WorkoutListParams extends ListParams {
  day?: DayOfWeek | '';
  owner?: string;
}
