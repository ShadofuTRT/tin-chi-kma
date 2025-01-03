import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppCalendarComponent } from './app-calendar/app-calendar.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [AppCalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
