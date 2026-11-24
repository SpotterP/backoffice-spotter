import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { Workout } from '../../models';
import { WorkoutsList } from './workouts-list';

const base = `${environment.apiUrl}/workouts`;
const usersUrl = `${environment.apiUrl}/users`;
const listUrl = ({ search = '', day = '', owner = '' }: { search?: string; day?: string; owner?: string } = {}) =>
  `${base}?page=1&limit=10${search ? `&search=${search}` : ''}${day ? `&day=${day}` : ''}${owner ? `&owner=${owner}` : ''}&sort=name&order=asc`;
const ownersUrl = `${usersUrl}?page=1&limit=100&sort=name&order=asc`;

const page = (workouts: Workout[] = [], total = workouts.length, pageNumber = 1) => ({
  workouts,
  pagination: {
    page: pageNumber,
    limit: 10,
    total,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
});

const ownersPage = (users = [{ _id: 'u1', name: 'Marta' }]) => ({
  users,
  pagination: {
    page: 1,
    limit: 100,
    total: users.length,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
});

const exercise = (id: string, name: string) => ({
  _id: id,
  name,
  category: 'LEGS' as const,
});

const workout = (over: Partial<Workout> = {}): Workout => ({
  _id: 'w1',
  name: 'Pierna',
  description: 'Cuádriceps',
  days: ['MONDAY', 'THURSDAY'],
  owner: { _id: 'u1', name: 'Marta' },
  exercises: [{ exercise: exercise('e1', 'Sentadilla'), sets: 4, reps: 10 }],
  ...over,
});

describe('WorkoutsList', () => {
  let component: WorkoutsList;
  let fixture: ComponentFixture<WorkoutsList>;
  let httpMock: HttpTestingController;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const bodyText = () =>
    (fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent ?? '';

  const open = async (workouts: Workout[] = []) => {
    fixture.detectChanges();
    httpMock.expectOne(listUrl()).flush(page(workouts));
    httpMock.expectOne(ownersUrl).flush(ownersPage());
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutsList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorkoutsList);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it('shows the pagination metadata of the API', async () => {
    await open();
    expect(component.total()).toBe(0);
    expect(component.totalPages()).toBe(1);
  });

  it('fills the owner filter with the users of the API', async () => {
    await open();
    expect(component.owners()).toEqual([{ _id: 'u1', name: 'Marta' }]);
    expect(text()).toContain('Marta');
  });

  it('filters by day with the day parameter of the API', async () => {
    await open();
    component.day.set('MONDAY');
    component.loadPage(1);
    const req = httpMock.expectOne(listUrl({ day: 'MONDAY' }));
    expect(req.request.params.has('dayOfWeek')).toBe(false);
    req.flush(page());
    expect(component.totalPages()).toBe(1);
  });

  it('filters by owner and clears the parameter when the filter is reset', async () => {
    await open();
    component.owner.set('u1');
    component.loadPage(1);
    const filtered = httpMock.expectOne(listUrl({ owner: 'u1' }));
    expect(filtered.request.params.get('owner')).toBe('u1');
    filtered.flush(page());

    component.owner.set('');
    component.loadPage(1);
    const cleared = httpMock.expectOne(listUrl());
    expect(cleared.request.params.has('owner')).toBe(false);
    cleared.flush(page());
  });

  it('keeps the filters and the sort when the page changes', async () => {
    await open();
    component.day.set('MONDAY');
    component.owner.set('u1');
    component.loadPage(2);
    httpMock
      .expectOne(`${base}?page=2&limit=10&day=MONDAY&owner=u1&sort=name&order=asc`)
      .flush(page([], 0, 2));
    expect(component.page()).toBe(2);
  });

  it('sends the search text and the page together with the filters', async () => {
    await open();
    component.search.set('pierna');
    component.day.set('THURSDAY');
    component.owner.set('u1');
    component.loadPage(1);
    httpMock.expectOne(listUrl({ search: 'pierna', day: 'THURSDAY', owner: 'u1' })).flush(page());
    expect(component.page()).toBe(1);
  });

  it('renders the owner of each workout, and a placeholder when it has none', async () => {
    await open([
      workout(),
      workout({ _id: 'w2', name: 'Brazo', owner: null }),
    ]);
    expect(component.workouts().length).toBe(2);
    expect(bodyText()).toContain('Marta');
    expect(bodyText()).toContain('Sin dueño');
  });

  it('renders every day of the workout, and a placeholder when it has none', async () => {
    await open([workout(), workout({ _id: 'w2', name: 'Brazo', days: [] })]);
    expect(bodyText()).toContain('Lunes, Jueves');
    expect(bodyText()).toContain('Sin días');
  });

  it('renders the exercises of the workout from the exercise wrapper', async () => {
    await open([workout({ exercises: [
      { exercise: exercise('e1', 'Sentadilla'), sets: 4, reps: 10 },
      { exercise: exercise('e2', 'Prensa'), sets: 3, reps: 12 },
    ] })]);
    expect(text()).toContain('Sentadilla');
    expect(text()).toContain('Prensa');
    expect(text()).not.toContain('undefined');
  });

  it('only offers name and description as sortable columns', async () => {
    await open();
    const headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('th button'),
    ).map((button) => (button.textContent ?? '').trim());

    expect(headers.some((header) => header.startsWith('Nombre'))).toBe(true);
    expect(headers.some((header) => header.startsWith('Descripción'))).toBe(true);
    expect(headers.some((header) => header.startsWith('Día'))).toBe(false);

    component.sortBy('description');
    httpMock.expectOne(`${base}?page=1&limit=10&sort=description&order=asc`).flush(page());
    expect(component.order()).toBe('asc');
  });

  it('soft delete and hard delete keep sending their own requests, then reload', async () => {
    await open([workout()]);

    component.askDelete(workout());
    component.softDelete();
    const soft = httpMock.expectOne(`${base}/w1`);
    expect(soft.request.method).toBe('DELETE');
    soft.flush(null);
    httpMock.expectOne(listUrl()).flush(page());

    component.askDelete(workout());
    component.hardDelete();
    const hard = httpMock.expectOne(`${base}/w1/hard`);
    expect(hard.request.method).toBe('DELETE');
    hard.flush(null);
    httpMock.expectOne(listUrl()).flush(page());

    expect(component.workoutToDelete()).toBeNull();
  });

  it('restore keeps sending PATCH to the restore url, then reloads', async () => {
    await open([workout({ isDeleted: true })]);
    component.restore(workout());
    const req = httpMock.expectOne(`${base}/w1/restore`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ workout: workout() });
    httpMock.expectOne(listUrl()).flush(page());
  });
});
