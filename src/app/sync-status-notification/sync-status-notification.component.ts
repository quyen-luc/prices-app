import { Component, OnInit, ChangeDetectionStrategy, HostBinding, ChangeDetectorRef } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { SyncStateService } from '../core/services/sync-state.service';
import { NotificationService } from '../core/services';

@Component({
  selector: 'app-sync-status-notification',
  templateUrl: './sync-status-notification.component.html',
  styleUrls: ['./sync-status-notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncStatusNotificationComponent implements OnInit {
  // Host bindings for contextual styling
  @HostBinding('class.error') get hasError() {
    return this.syncStateService.getCurrentState().syncError;
  }
  
  @HostBinding('class.uploading') get isUploading() {
    return this.syncStateService.getCurrentState().syncDirection === 'upload';
  }
  
  @HostBinding('class.downloading') get isDownloading() {
    return this.syncStateService.getCurrentState().syncDirection === 'download';
  }

  // Use the service's observables
  isSyncing$: Observable<boolean>;
  syncDirection$: Observable<'upload' | 'download' | 'full' | null>;
  pendingUploads$: Observable<number>;
  pendingDownloads$: Observable<number>;
  syncError$: Observable<string>;
  uploadedCount$: Observable<number>;
  downloadedCount$: Observable<number>;
  
  // Derived observables
  hasPendingChanges$: Observable<boolean>;
  showNotification$: Observable<boolean>;

  constructor(private syncStateService: SyncStateService, private notificationService: NotificationService, private changeDetectorRef: ChangeDetectorRef) {
    this.isSyncing$ = this.syncStateService.isSyncing$;
    this.syncDirection$ = this.syncStateService.syncDirection$;
    this.pendingUploads$ = this.syncStateService.pendingUploads$;
    this.pendingDownloads$ = this.syncStateService.pendingDownloads$;
    this.syncError$ = this.syncStateService.syncError$;
    this.uploadedCount$ = this.syncStateService.uploadedCount$;
    this.downloadedCount$ = this.syncStateService.downloadedCount$;
    
    // Show notification when syncing, have pending changes, or there's an error
    this.hasPendingChanges$ = combineLatest([
      this.pendingUploads$,
      this.pendingDownloads$
    ]).pipe(
      map(([uploads, downloads]) => uploads > 0 || downloads > 0)
    );
    
    this.showNotification$ = combineLatest([
      this.isSyncing$,
      this.hasPendingChanges$,
      this.syncError$
    ]).pipe(
      map(([isSyncing, hasPendingChanges, error]) => 
        isSyncing || hasPendingChanges || !!error
      )
    );
  }

  ngOnInit(): void {
    // Refresh status on init
    setInterval(() => {
      this.syncStateService.getSyncStatus();
    }, 1000 * 60); // Refresh every minute
  }

  async performFullSync(): Promise<void> {
    const result = await this.syncStateService.performFullSync();

    if(result) {
      this.notificationService.showSuccess('Product Synchronization', 'Full synchronization completed successfully.');
    } else {
      this.notificationService.showError('Product Synchronization', 'Full synchronization failed.');
    }
  }
}