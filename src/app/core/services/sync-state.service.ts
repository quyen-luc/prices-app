import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from './electron/electron.service';

export interface SyncStatus {
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  pendingUploads: number;
  pendingDownloads: number;
  lastSyncTime: Date | null;
  syncError: string;
  syncDirection: 'upload' | 'download' | 'full' | null;
  uploadedCount?: number;
  downloadedCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyncStateService {
  // Private subjects
  private _isSyncing = new BehaviorSubject<boolean>(false);
  private _autoSyncEnabled = new BehaviorSubject<boolean>(false);
  private _pendingUploads = new BehaviorSubject<number>(0);
  private _pendingDownloads = new BehaviorSubject<number>(0);
  private _lastSyncTime = new BehaviorSubject<Date | null>(null);
  private _syncError = new BehaviorSubject<string>('');
  private _syncDirection = new BehaviorSubject<'upload' | 'download' | 'full' | null>(null);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _uploadedCount = new BehaviorSubject<number>(0);
  private _downloadedCount = new BehaviorSubject<number>(0);

  // Public observables
  readonly isSyncing$: Observable<boolean> = this._isSyncing.asObservable();
  readonly autoSyncEnabled$: Observable<boolean> = this._autoSyncEnabled.asObservable();
  readonly pendingUploads$: Observable<number> = this._pendingUploads.asObservable();
  readonly pendingDownloads$: Observable<number> = this._pendingDownloads.asObservable();
  readonly lastSyncTime$: Observable<Date | null> = this._lastSyncTime.asObservable();
  readonly syncError$: Observable<string> = this._syncError.asObservable();
  readonly syncDirection$: Observable<'upload' | 'download' | 'full' | null> = this._syncDirection.asObservable();
  readonly isLoading$: Observable<boolean> = this._isLoading.asObservable();
  readonly uploadedCount$: Observable<number> = this._uploadedCount.asObservable();
  readonly downloadedCount$: Observable<number> = this._downloadedCount.asObservable();

  constructor(private electronService: ElectronService) {
    this.initialize();
  }

  private initialize(): void {
    if (!this.electronService.isElectron) return;

    // Listen for sync status changes
    this.electronService.ipcRenderer.on(
      'product-sync-status-changed',
      (event, status) => {
        this._isSyncing.next(status.isSyncing);
        this._syncDirection.next(status.direction || null);

        // Track uploaded/downloaded counts when provided
        if (status.uploadedCount !== undefined) {
          this._uploadedCount.next(status.uploadedCount);
        }
        if (status.downloadedCount !== undefined) {
          this._downloadedCount.next(status.downloadedCount);
        }

        if (status.status === 'completed') {
          this._lastSyncTime.next(new Date());
          this._syncError.next('');
          this.getSyncStatus(); // Refresh counters
        } else if (status.status === 'failed') {
          this._syncError.next(status.error || 'Sync failed');
        }
      }
    );

    // Get initial sync status
    this.getSyncStatus();
  }

  async getSyncStatus(): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      this._isLoading.next(true);
      const status = await this.electronService.ipcRenderer.invoke(
        'get-product-sync-status'
      );
      this._pendingUploads.next(status.pendingUploads);
      this._pendingDownloads.next(status.pendingDownloads);
      this._autoSyncEnabled.next(status.autoSyncEnabled);
      
      if (status.lastSyncedAt) {
        this._lastSyncTime.next(new Date(status.lastSyncedAt));
      }
    } catch (error) {
      console.error('Error getting product sync status:', error);
    } finally {
      this._isLoading.next(false);
    }
  }

  async toggleAutoSync(enabled?: boolean): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      const newValue = enabled !== undefined ? enabled : !this._autoSyncEnabled.value;
      const result = await this.electronService.ipcRenderer.invoke(
        'toggle-product-auto-sync',
        newValue
      );
      this._autoSyncEnabled.next(result.autoSyncEnabled);
    } catch (error) {
      console.error('Error toggling auto sync:', error);
    }
  }

  async syncProducts(): Promise<boolean> {
    if (!this.electronService.isElectron || this._isSyncing.value) return false;

    try {
      this._isSyncing.next(true);
      this._syncDirection.next('upload');
      this._syncError.next('');

      const result = await this.electronService.ipcRenderer.invoke(
        'sync-products'
      );

      if (!result.success) {
        this._syncError.next(result.error || 'Failed to upload products');
        return false;
      } else {
        this._lastSyncTime.next(new Date());
        this._uploadedCount.next(result.uploaded || 0);
        await this.getSyncStatus();
        return true;
      }
    } catch (error) {
      this._syncError.next(error.message || 'Error uploading products');
      console.error('Error syncing products:', error);
      return false;
    } finally {
      this._isSyncing.next(false);
      this._syncDirection.next(null);
    }
  }

  async pullProducts(): Promise<boolean> {
    if (!this.electronService.isElectron || this._isSyncing.value) return false;

    try {
      this._isSyncing.next(true);
      this._syncDirection.next('download');
      this._syncError.next('');

      const result = await this.electronService.ipcRenderer.invoke(
        'pull-remote-products'
      );

      if (!result.success) {
        this._syncError.next(result.error || 'Failed to download products');
        return false;
      } else {
        this._lastSyncTime.next(new Date());
        this._downloadedCount.next(result.downloaded || 0);
        await this.getSyncStatus();
        return true;
      }
    } catch (error) {
      this._syncError.next(error.message || 'Error downloading products');
      console.error('Error pulling products:', error);
      return false;
    } finally {
      this._isSyncing.next(false);
      this._syncDirection.next(null);
    }
  }

  async performFullSync(): Promise<boolean> {
    if (!this.electronService.isElectron || this._isSyncing.value) return false;

    try {
      this._syncDirection.next('full');
      this._syncError.next('');

      // First sync local changes
      const uploadSuccess = await this.syncProducts();

      // Then pull remote changes
      const downloadSuccess = await this.pullProducts();

      this._lastSyncTime.next(new Date());
      return uploadSuccess && downloadSuccess;
    } catch (error) {
      this._syncError.next(error.message || 'Error during full sync');
      console.error('Error performing full sync:', error);
      return false;
    } finally {
      this._isSyncing.next(false);
      this._syncDirection.next(null);
    }
  }

  // Cleanup method for OnDestroy
  destroy(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.removeAllListeners(
        'product-sync-status-changed'
      );
    }
  }

  // Helper to get current values
  getCurrentState(): SyncStatus {
    return {
      isSyncing: this._isSyncing.value,
      autoSyncEnabled: this._autoSyncEnabled.value,
      pendingUploads: this._pendingUploads.value,
      pendingDownloads: this._pendingDownloads.value,
      lastSyncTime: this._lastSyncTime.value,
      syncError: this._syncError.value,
      syncDirection: this._syncDirection.value,
      uploadedCount: this._uploadedCount.value,
      downloadedCount: this._downloadedCount.value
    };
  }
}