import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeRepository } from '../testing/fake-repository';
import { App } from './app';
import { KalRepository } from './core/repository';

describe('App', () => {
  it('creates the root component', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: KalRepository, useValue: new FakeRepository() }],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
