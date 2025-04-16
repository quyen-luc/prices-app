import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Observable } from 'rxjs';
import { SyncStateService } from '../core/services/sync-state.service';
import { DialogBaseComponent } from '../shared/abstracts/dialog-base.component';

@Component({
  selector: 'app-product-sync-status',
  templateUrl: './product-sync-status.component.html',
  styleUrls: ['./product-sync-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSyncStatusComponent
  extends DialogBaseComponent<any, any>
  implements OnInit
{
  // Use the service's observables directly
  isSyncing$: Observable<boolean>;
  autoSyncEnabled$: Observable<boolean>;
  pendingUploads$: Observable<number>;
  pendingDownloads$: Observable<number>;
  lastSyncTime$: Observable<Date | null>;
  syncError$: Observable<string>;
  syncDirection$: Observable<'upload' | 'download' | 'full' | null>;
  isLoading$: Observable<boolean>;
  uploadedCount$: Observable<number>;
  downloadedCount$: Observable<number>;

  constructor(
    private syncStateService: SyncStateService,
  ) {
    super();
    
    // Initialize observables from the service
    this.isSyncing$ = this.syncStateService.isSyncing$;
    this.autoSyncEnabled$ = this.syncStateService.autoSyncEnabled$;
    this.pendingUploads$ = this.syncStateService.pendingUploads$;
    this.pendingDownloads$ = this.syncStateService.pendingDownloads$;
    this.lastSyncTime$ = this.syncStateService.lastSyncTime$;
    this.syncError$ = this.syncStateService.syncError$;
    this.syncDirection$ = this.syncStateService.syncDirection$;
    this.isLoading$ = this.syncStateService.isLoading$;
    this.uploadedCount$ = this.syncStateService.uploadedCount$;
    this.downloadedCount$ = this.syncStateService.downloadedCount$;
  }

  ngOnInit(): void {
    // Refresh sync status when component initializes
    this.syncStateService.getSyncStatus();
  }


  async toggleAutoSync(): Promise<void> {
    await this.syncStateService.toggleAutoSync();
  }

  async syncProducts(): Promise<void> {
    const success = await this.syncStateService.syncProducts();
    if (success) {
      this.close({ success: true });
    }
  }

  async pullProducts(): Promise<void> {
    await this.syncStateService.pullProducts();
  }

  async performFullSync(): Promise<void> {
    await this.syncStateService.performFullSync();
  }
}