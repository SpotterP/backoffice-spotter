import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { ExerciseForm } from './exercise-form';

const base = `${environment.apiUrl}/exercises`;

// Un ejercicio del catálogo tiene solo nombre y categoría
const plancha = { _id: 'e1', name: 'Plancha', category: 'CORE' as const };

describe('ExerciseForm', () => {
  let component: ExerciseForm;
  let fixture: ComponentFixture<ExerciseForm>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ExerciseForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  /** Crea el formulario como edición: el id tiene que estar antes del primer detectChanges */
  const editFixture = async () => {
    const edit = TestBed.createComponent(ExerciseForm);
    edit.componentRef.setInput('id', 'e1');
    edit.detectChanges();
    httpMock.expectOne(`${base}/e1`).flush({ exercise: plancha });
    await edit.whenStable();
    edit.detectChanges();
    return edit;
  };

  it('has only name and category as form controls', () => {
    expect(Object.keys(component.form.controls)).toEqual(['name', 'category']);
  });

  it('renders only the name and category fields', () => {
    expect(html().querySelectorAll('input').length).toBe(1);
    expect((html().querySelector('input') as HTMLInputElement).type).toBe('text');
    expect(html().querySelectorAll('select').length).toBe(1);
    expect(html().querySelectorAll('input[type="number"]').length).toBe(0);

    const text = html().textContent ?? '';
    expect(text).toContain('Nombre');
    expect(text).toContain('Categoría');
    expect(text).not.toContain('Series');
    expect(text).not.toContain('Repeticiones');
  });

  it('sends exactly the name and the category when creating, and only after confirming', () => {
    component.form.patchValue({ name: 'Press banca', category: 'CHEST' });
    component.save();
    expect(component.confirmOpen()).toBe(true);
    httpMock.expectNone(base);

    component.confirmSave();
    const request = httpMock.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Press banca', category: 'CHEST' });
    request.flush({ exercise: { _id: 'e2', name: 'Press banca', category: 'CHEST' } });

    expect(navigate).toHaveBeenCalledWith(['/exercises'], { replaceUrl: true });
  });

  it('fills both fields from the exercise returned by the API when editing', async () => {
    const edit = await editFixture();
    const element = edit.nativeElement as HTMLElement;

    expect((element.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Plancha');
    expect((element.querySelector('select') as HTMLSelectElement).value).toBe('CORE');
  });

  it('sends exactly the name and the category when editing', async () => {
    const edit = await editFixture();
    const text = (edit.nativeElement as HTMLElement).querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    text.value = 'Plancha lateral';
    text.dispatchEvent(new Event('input'));
    edit.detectChanges();

    edit.componentInstance.save();
    edit.componentInstance.confirmSave();
    const request = httpMock.expectOne(`${base}/e1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Plancha lateral', category: 'CORE' });
    request.flush({ exercise: { ...plancha, name: 'Plancha lateral' } });
    await edit.whenStable();
  });

  it('sends nothing when the name is missing or blank', () => {
    for (const name of ['', '   ']) {
      component.form.patchValue({ name });
      component.save();
      fixture.detectChanges();

      expect(component.confirmOpen()).toBe(false);
      expect(html().querySelector('.field-error')?.textContent?.trim()).toBe(
        'El nombre es obligatorio',
      );
      httpMock.expectNone(base);
    }
  });
});
