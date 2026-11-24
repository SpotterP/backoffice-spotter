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

// Al crear o editar se envía el contrato nuevo: varios días y los ejercicios con sus series y
// repeticiones. Sin owner, el backend usa el usuario del token
// (Joi rechaza con 422 cualquier clave que no esté aquí, dayOfWeek incluido)
export interface WorkoutInput {
  name: string;
  description?: string;
  owner?: string;
  days: DayOfWeek[];
  exercises: { exercise: string; sets: number; reps: number }[];
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
