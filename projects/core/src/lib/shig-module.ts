import {CUSTOM_ELEMENTS_SCHEMA, NgModule, NO_ERRORS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  AudioMeterComponent,
  DeviceCaptureComponent,
  GuestListDirective,
  GuestListComponent,
  GuestComponent,
  LobbyComponent,
} from './component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';

// import '@material/web/common';


@NgModule({
  declarations: [
    AudioMeterComponent,
    DeviceCaptureComponent,
    LobbyComponent,
    GuestListDirective,
    GuestListComponent,
    GuestComponent
  ],
  exports: [
    AudioMeterComponent,
    DeviceCaptureComponent,
    LobbyComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
  imports: [CommonModule,
    FormsModule,
    ReactiveFormsModule], providers: [provideHttpClient(withInterceptorsFromDi())]
})
export class ShigModule {
}
