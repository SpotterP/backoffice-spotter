import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  DayOfWeek,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  UserSummary,
  Workout,
  WorkoutInput,
} from '../../models';
import { ExerciseService } from '../../services/exercise.service';
import { UserService } from '../../services/user.service';
import { WorkoutService } from '../../services/workout.service';
import { apiErrorMessage } from '../../utils/api-error';
import { ConfirmModal } from '../confirm-modal/confirm-modal';

// Una fila del formulario: el ejercicio elegido y sus series y repeticiones. El orden de las
// filas es el orden de la rutina
interface ExerciseRowForm {
  exercise: FormControl<string>;
  sets: FormControl<number>;
  reps: FormControl<number>;
}

// El dueño y los usuarios del desplegable se piden de una vez (la API admite hasta 100)
const OWNERS_PAGE_SIZE = 100;

@Component({
  selector: 'app-workout-form',
  imports: [ReactiveFormsModule, RouterLink, ConfirmModal],
  templateUrl: './workout-form.html',
  styles: `
    :host {
      display: block;
      max-width: 560px;
    }
  `,
})
export class WorkoutForm implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private userService = inject(UserService);
  private router = inject(Router);

  // Viene del :id de la ruta. En workouts/new no hay id y el formulario sirve para crear
  id = input<string>();

  // Opciones del selector de ejercicios (la API permite pedir hasta 100 de golpe)
  exercises = signal<Exercise[]>([]);
  // Usuarios del selector de dueño. Vacío quiere decir que el backend usa el del token
  owners = signal<UserSummary[]>([]);
  readonly days = DAYS_OF_WEEK;
  readonly dayLabels = DAY_LABELS;
  readonly categoryLabels = EXERCISE_CATEGORY_LABELS;

  loading = signal(false);
  loadFailed = signal(false);
  saving = signal(false);
  // Aviso de confirmación que se enseña antes de enviar el formulario
  confirmOpen = signal(false);
  error = signal('');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
    owner: [''],
    // Los días son casillas: puede no haber ninguno marcado
    days: this.fb.group({
      MONDAY: [false],
      TUESDAY: [false],
      WEDNESDAY: [false],
      THURSDAY: [false],
      FRIDAY: [false],
      SATURDAY: [false],
      SUNDAY: [false],
    }),
    exercises: this.fb.array<FormGroup<ExerciseRowForm>>([]),
  });

  get exerciseRows(): FormArray<FormGroup<ExerciseRowForm>> {
    return this.form.controls.exercises;
  }

  ngOnInit(): void {
    this.exerciseService.getExercises({ limit: 100 }).subscribe({
      // Un ADMIN recibe también los ejercicios borrados lógicamente: no se pueden elegir
      next: (response) => this.exercises.set(response.exercises.filter((exercise) => !exercise.isDeleted)),
      error: (err: HttpErrorResponse) => this.error.set(apiErrorMessage(err)),
    });

    this.userService
      .getUsers({ page: 1, limit: OWNERS_PAGE_SIZE, sort: 'name', order: 'asc' })
      .subscribe({
        next: (response) => this.owners.set(response.users),
        error: (err: HttpErrorResponse) => this.error.set(apiErrorMessage(err)),
      });

    const id = this.id();
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.workoutService.getWorkout(id).subscribe({
      next: (response) => {
        this.fillForm(response.workout);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // No se guarda hasta que el usuario confirma en el aviso
    this.confirmOpen.set(true);
  }

  cancelSave(): void {
    this.confirmOpen.set(false);
  }

  confirmSave(): void {
    this.confirmOpen.set(false);

    const id = this.id();
    // La API reemplaza la rutina entera al editar. La descripción puede ir vacía (Joi la
    // acepta), así que si la borras en el formulario también se borra en la API
    const raw = this.form.getRawValue();
    const workout: WorkoutInput = {
      name: raw.name,
      description: raw.description,
      days: this.selectedDays(),
      exercises: raw.exercises.map((row) => ({
        exercise: row.exercise,
        sets: row.sets,
        reps: row.reps,
      })),
    };
    // Sin dueño se omite la clave y el backend usa el usuario del token
    if (raw.owner) {
      workout.owner = raw.owner;
    }

    const request = id
      ? this.workoutService.updateWorkout(id, workout)
      : this.workoutService.createWorkout(workout);

    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => this.router.navigate(['/workouts'], { replaceUrl: true }),
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  /** Añade una fila al final de la rutina */
  addExercise(exercise = '', sets = 1, reps = 1): void {
    this.exerciseRows.push(this.buildRow(exercise, sets, reps));
  }

  /** Mueve una fila de posición: -1 la sube y +1 la baja */
  moveExercise(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.exerciseRows.length) {
      return;
    }

    const row = this.exerciseRows.at(index);
    this.exerciseRows.removeAt(index);
    this.exerciseRows.insert(target, row);
  }

  removeExercise(index: number): void {
    this.exerciseRows.removeAt(index);
  }

  private buildRow(exercise: string, sets: number, reps: number): FormGroup<ExerciseRowForm> {
    // Series y repeticiones son enteros >= 1: la API rechaza con 422 el 0 y los decimales
    return this.fb.group({
      exercise: this.fb.control(exercise, Validators.required),
      sets: this.fb.control(sets, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
      reps: this.fb.control(reps, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
    });
  }

  // Los días se mandan en orden de semana (el backend rechaza los repetidos)
  private selectedDays(): DayOfWeek[] {
    const selected = this.form.controls.days.getRawValue();
    return DAYS_OF_WEEK.filter((day) => selected[day]);
  }

  private fillForm(workout: Workout): void {
    const days = this.form.controls.days;
    for (const day of DAYS_OF_WEEK) {
      days.controls[day].setValue(workout.days.includes(day));
    }

    this.form.patchValue({
      name: workout.name,
      description: workout.description ?? '',
      owner: workout.owner?._id ?? '',
    });

    // La API manda cada ejercicio con su id, sus series y sus repeticiones, en el orden de la
    // rutina
    this.exerciseRows.clear();
    for (const item of workout.exercises) {
      this.addExercise(item.exercise._id, item.sets, item.reps);
    }
  }
}
