import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {LoadingIndicatorComponent} from './loading-indicator.component';
import {LoadingService} from '../../provider/loading.service';

describe('LoadingIndicatorComponent modes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingIndicatorComponent], providers: [provideRouter([])],
    }).compileComponents();
  });

  it('keeps the existing global service-controlled overlay', async () => {
    const fixture = TestBed.createComponent(LoadingIndicatorComponent);
    fixture.autoDetectChanges();
    const service = TestBed.inject(LoadingService);
    service.loadingOn();
    await fixture.whenStable();
    const overlay = fixture.nativeElement.querySelector('.spinner-container');
    expect(overlay).not.toBeNull();
    expect(getComputedStyle(overlay).position).toBe('fixed');
    service.loadingOff();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.spinner-container')).toBeNull();
    fixture.destroy();
  });

  it('controls the local overlay independently of the global service', async () => {
    const fixture = TestBed.createComponent(LoadingIndicatorComponent);
    fixture.componentRef.setInput('local', true);
    fixture.componentRef.setInput('active', false);
    fixture.autoDetectChanges();
    const service = TestBed.inject(LoadingService);
    service.loadingOn();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.spinner-container')).toBeNull();
    service.loadingOff();
    fixture.componentRef.setInput('active', true);
    await fixture.whenStable();
    const overlay = fixture.nativeElement.querySelector('.spinner-container.local');
    expect(getComputedStyle(overlay).position).toBe('absolute');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.loader')).width).toBe('48px');
    fixture.destroy();
  });
});
