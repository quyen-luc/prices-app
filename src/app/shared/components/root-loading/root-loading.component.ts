import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { LoadingService } from '../../services/loading.service';
import { Subscription, tap } from 'rxjs';

@Component({
  selector: 'app-root-loading',
  template: `
    <app-loading-spinner
      [show]="(isLoading$ | async)?.show"
      [message]="loadingMessage"
      [fullscreen]="true"
      [size]="'medium'"
    >
    </app-loading-spinner>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RootLoadingComponent {
  loadingMessage = 'Loading...';

  isLoading$ = this.loadingService.loading$.pipe(
    tap((state) => {
      this.loadingMessage = state.message || 'Loading...';
    })
  );

  constructor(
    private loadingService: LoadingService,
  ) {}
}
