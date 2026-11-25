import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { DAYS_OF_WEEK, ExerciseCategory, Workout } from '../../models';
import { WorkoutForm } from './workout-form';

const workoutsUrl = `${environment.apiUrl}/workouts`;
const usersUrl = `${environment.apiUrl}/users`;
const exercisesUrl = `${environment.apiUrl}/exercises`;
const ownersUrl = `${usersUrl}?page=1&limit=100&sort=name&order=asc`;
const exercisesListUrl = `${exercisesUrl}?limit=100`;

const pagination = (limit: number, total: number) => ({
  page: 1,
  limit,
  total,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

const exercise = (id: string, name: string, category: ExerciseCategory) => ({
  _id: id,
  name,
  category,
});

const exercisesPage = () => ({
  exercises: [exercise('e1', 'Sentadilla', 'LEGS'), exercise('e2', 'Press banca', 'CHEST')],
  pagination: pagination(100, 2),
});

const ownersPage = () => ({
  users: [
    { _id: 'u1', name: 'Marta' },
    { _id: 'u2', name: 'Luis' },
  ],
  pagination: pagination(100, 2),
});

const workoutFixture = (over: Partial<Workout> = {}): Workout => ({
  _id: 'w1',
  name: 'Full body',
  description: 'Todo el cuerpo',
  days: ['TUESDAY', 'FRIDAY'],
  owner: { _id: 'u1', name: 'Marta' },
  exercises: [
    { exercise: exercise('e1', 'Sentadilla', 'LEGS'), sets: 4, reps: 10 },
    { exercise: exercise('e2', 'Press banca', 'CHEST'), sets: 3, reps: 8 },
  ],
  ...over,
});

describe('WorkoutForm', () => {
  let component: WorkoutForm;
  let fixture: ComponentFixture<WorkoutForm>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const html = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(html().querySelectorAll<HTMLElement>('.exercise-row'));
  const ownerSelect = () => html().querySelector('.owner select') as HTMLSelectElement;
  const nameInput = () => html().querySelector('input[type="text"]') as HTMLInputElement;
  const descriptionInput = () => html().querySelector('textarea') as HTMLTextAreaElement;
  const dayBox = (day: string) => html().querySelector(`input[data-day="${day}"]`) as HTMLInputElement;

  const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event('input'));
  };

  const checkDay = (day: string) => {
    const box = dayBox(day);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const pickOwner = (ownerId: string) => {
    const select = ownerSelect();
    select.value = ownerId;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const addRow = () => {
    (html().querySelector('.add-exercise') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  const setRow = (index: number, exerciseId: string, sets: number, reps: number) => {
    const row = rows()[index];
    const select = row.querySelector('select') as HTMLSelectElement;
    select.value = exerciseId;
    select.dispatchEvent(new Event('change'));

    const [setsInput, repsInput] = Array.from(
      row.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    );
    setsInput.value = String(sets);
    setsInput.dispatchEvent(new Event('input'));
    repsInput.value = String(reps);
    repsInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  // Nombre y una fila válida: lo mínimo para que el formulario se pueda guardar
  const fillMinimum = () => {
    typeInto(nameInput(), 'Pierna');
    addRow();
    setRow(0, 'e1', 4, 10);
    fixture.detectChanges();
  };

  // Pulsa Guardar y confirma en el aviso: el envío solo sale al confirmar
  const submit = () => {
    component.save();
    fixture.detectChanges();
    expect(component.confirmOpen()).toBe(true);
    component.confirmSave();
  };

  const open = async () => {
    fixture.detectChanges();
    httpMock.expectOne(exercisesListUrl).flush(exercisesPage());
    httpMock.expectOne(ownersUrl).flush(ownersPage());
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(WorkoutForm);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  /** Crea el formulario como edición: el id tiene que estar antes del primer detectChanges */
  const editFixture = async () => {
    // El fixture de beforeEach no se llega a pintar y en modo zoneless detectChanges pinta
    // todas las vistas de test: se destruye para que no dispare sus peticiones
    fixture.destroy();

    const edit = TestBed.createComponent(WorkoutForm);
    edit.componentRef.setInput('id', 'w1');
    edit.detectChanges();
    httpMock.expectOne(exercisesListUrl).flush(exercisesPage());
    httpMock.expectOne(ownersUrl).flush(ownersPage());
    httpMock.expectOne(`${workoutsUrl}/w1`).flush({ workout: workoutFixture() });
    await edit.whenStable();
    edit.detectChanges();
    return edit;
  };

  it('fills the owner select with the users of the API and an empty option', async () => {
    await open();

    expect(component.owners()).toEqual([
      { _id: 'u1', name: 'Marta' },
      { _id: 'u2', name: 'Luis' },
    ]);
    const options = Array.from(ownerSelect().options).map((option) => ({
      value: option.value,
      text: (option.textContent ?? '').trim(),
    }));
    expect(options).toEqual([
      { value: '', text: 'Sin dueño' },
      { value: 'u1', text: 'Marta' },
      { value: 'u2', text: 'Luis' },
    ]);
    expect(ownerSelect().value).toBe('');
  });

  it('renders the seven weekdays as checkboxes and no single day field', async () => {
    await open();

    const boxes = Array.from(html().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes.map((box) => box.getAttribute('data-day'))).toEqual([...DAYS_OF_WEEK]);

    const text = html().textContent ?? '';
    for (const label of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(text).toContain(label);
    }
    expect(html().querySelector('[formcontrolname="dayOfWeek"]')).toBeNull();
  });

  it('starts with no exercise rows and appends one with the add exercise button', async () => {
    await open();
    expect(rows().length).toBe(0);
    expect(html().querySelector('select[multiple]')).toBeNull();

    addRow();
    const row = rows()[0];
    expect(rows().length).toBe(1);
    expect(row.querySelectorAll('select').length).toBe(1);
    expect(row.querySelectorAll('input[type="number"]').length).toBe(2);
    expect(row.querySelector('.move-up')).not.toBeNull();
    expect(row.querySelector('.move-down')).not.toBeNull();
    expect(row.querySelector('.remove')).not.toBeNull();
  });

  it('creates with exactly name, description, days, owner and exercises, and no dayOfWeek', async () => {
    await open();

    typeInto(nameInput(), 'Pierna');
    typeInto(descriptionInput(), 'Cuádriceps');
    pickOwner('u1');
    // Se marcan al revés para comprobar que el payload va en orden de semana
    checkDay('THURSDAY');
    checkDay('MONDAY');
    addRow();
    setRow(0, 'e1', 4, 10);

    submit();

    const request = httpMock.expectOne(workoutsUrl);
    expect(request.request.method).toBe('POST');
    expect('dayOfWeek' in request.request.body).toBe(false);
    expect(request.request.body).toEqual({
      name: 'Pierna',
      description: 'Cuádriceps',
      days: ['MONDAY', 'THURSDAY'],
      owner: 'u1',
      exercises: [{ exercise: 'e1', sets: 4, reps: 10 }],
    });
    expect(typeof request.request.body.exercises[0].sets).toBe('number');
    expect(typeof request.request.body.exercises[0].reps).toBe('number');
    request.flush({ workout: workoutFixture() });

    expect(navigate).toHaveBeenCalledWith(['/workouts'], { replaceUrl: true });
  });

  it('omits the owner key and sends empty days when nothing is picked', async () => {
    await open();
    fillMinimum();

    submit();

    const request = httpMock.expectOne(workoutsUrl);
    expect('owner' in request.request.body).toBe(false);
    expect(request.request.body.days).toEqual([]);
    expect('dayOfWeek' in request.request.body).toBe(false);
    request.flush({ workout: workoutFixture() });
  });

  it('sends the exercises in the order left by the move buttons', async () => {
    await open();
    fillMinimum();
    addRow();
    setRow(1, 'e2', 3, 8);

    (rows()[0].querySelector('.move-down') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows().map((row) => (row.querySelector('select') as HTMLSelectElement).value)).toEqual([
      'e2',
      'e1',
    ]);

    submit();

    const request = httpMock.expectOne(workoutsUrl);
    expect(request.request.body.exercises).toEqual([
      { exercise: 'e2', sets: 3, reps: 8 },
      { exercise: 'e1', sets: 4, reps: 10 },
    ]);
    request.flush({ workout: workoutFixture() });
  });

  it('drops the removed exercise from the payload', async () => {
    await open();
    fillMinimum();
    addRow();
    setRow(1, 'e2', 3, 8);

    (rows()[0].querySelector('.remove') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows().length).toBe(1);

    submit();

    const request = httpMock.expectOne(workoutsUrl);
    expect(request.request.body.exercises).toEqual([{ exercise: 'e2', sets: 3, reps: 8 }]);
    request.flush({ workout: workoutFixture() });
  });

  it('blocks the save when sets or reps are not integers greater than zero', async () => {
    await open();
    fillMinimum();

    for (const [sets, reps] of [
      [0, 10],
      [4, 0],
      [1.5, 10],
      [4, 2.5],
    ]) {
      setRow(0, 'e1', sets, reps);
      component.save();
      fixture.detectChanges();

      expect(component.confirmOpen()).toBe(false);
      expect(html().querySelectorAll('.field-error').length).toBeGreaterThan(0);
      httpMock.expectNone(workoutsUrl);
    }
  });

  it('fills name, description, owner, days and the exercise rows when editing', async () => {
    const edit = await editFixture();
    const root = edit.nativeElement as HTMLElement;

    expect((root.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Full body');
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Todo el cuerpo');
    expect((root.querySelector('.owner select') as HTMLSelectElement).value).toBe('u1');
    expect((root.querySelector('input[data-day="TUESDAY"]') as HTMLInputElement).checked).toBe(true);
    expect((root.querySelector('input[data-day="FRIDAY"]') as HTMLInputElement).checked).toBe(true);
    expect((root.querySelector('input[data-day="MONDAY"]') as HTMLInputElement).checked).toBe(false);

    const rowsData = Array.from(root.querySelectorAll<HTMLElement>('.exercise-row')).map((row) => {
      const [sets, reps] = Array.from(
        row.querySelectorAll<HTMLInputElement>('input[type="number"]'),
      );
      return {
        exercise: (row.querySelector('select') as HTMLSelectElement).value,
        sets: sets.value,
        reps: reps.value,
      };
    });
    expect(rowsData).toEqual([
      { exercise: 'e1', sets: '4', reps: '10' },
      { exercise: 'e2', sets: '3', reps: '8' },
    ]);
  });

  it('sends the filled days, owner and exercises back when editing', async () => {
    const edit = await editFixture();

    edit.componentInstance.save();
    edit.detectChanges();
    expect(edit.componentInstance.confirmOpen()).toBe(true);
    edit.componentInstance.confirmSave();

    const request = httpMock.expectOne(`${workoutsUrl}/w1`);
    expect(request.request.method).toBe('PUT');
    expect('dayOfWeek' in request.request.body).toBe(false);
    expect(request.request.body).toEqual({
      name: 'Full body',
      description: 'Todo el cuerpo',
      days: ['TUESDAY', 'FRIDAY'],
      owner: 'u1',
      exercises: [
        { exercise: 'e1', sets: 4, reps: 10 },
        { exercise: 'e2', sets: 3, reps: 8 },
      ],
    });
    request.flush({ workout: workoutFixture() });
    expect(navigate).toHaveBeenCalledWith(['/workouts'], { replaceUrl: true });
  });
});
