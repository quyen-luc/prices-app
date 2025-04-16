import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ElectronService } from '../core/services';

@Component({
  selector: 'app-database-status',
  templateUrl: './database-status.component.html',
  styleUrls: ['./database-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatabaseStatusComponent implements OnInit, OnDestroy {
  isDbConnected = new BehaviorSubject<boolean>(true);
  isInternetConnected = new BehaviorSubject<boolean>(true);
  isReconnecting = new BehaviorSubject<boolean>(false);
  reconnectAttempt = new BehaviorSubject<number>(0);
  maxReconnectAttempts = new BehaviorSubject<number>(5);
  errorMessage = new BehaviorSubject<string>('');
  pendingProductSyncs = new BehaviorSubject<number>(0);

  constructor(private electronService: ElectronService) {}

  ngOnInit(): void {
    if (this.electronService.isElectron) {
      // Listen for connection status updates
      this.electronService.ipcRenderer.on(
        'db-connection-status',
        (event, status) => {
          this.isDbConnected.next(status.connected);
          this.isInternetConnected.next(status.internetConnected);

          if (!status.connected && status.error) {
            this.errorMessage.next(status.error);
          } else if (status.connected) {
            this.errorMessage.next('');
          }
        }
      );

      // Listen for reconnection status updates
      this.electronService.ipcRenderer.on(
        'db-reconnecting-status',
        (event, status) => {
          this.isReconnecting.next(status.reconnecting);
          this.reconnectAttempt.next(status.attemptNumber);
          this.maxReconnectAttempts.next(status.maxAttempts);
        }
      );

      this.electronService.ipcRenderer.on(
        'product-sync-status-changed',
        (event, status) => {
          this.getProductSyncStatus();
        }
      );

      // Initial check
      this.checkConnections();
      this.getProductSyncStatus();
    }
  }

  ngOnDestroy(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.removeAllListeners(
        'db-connection-status'
      );
      this.electronService.ipcRenderer.removeAllListeners(
        'db-reconnecting-status'
      );
    }
  }

  async checkConnections(): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      // Check internet connection
      const internetStatus = await this.electronService.ipcRenderer.invoke(
        'check-internet-connection'
      );
      this.isInternetConnected.next(internetStatus.connected);

      // Check database connection
      const dbStatus = await this.electronService.ipcRenderer.invoke(
        'check-db-connection'
      );
      this.isDbConnected.next(dbStatus.connected);
    } catch (error) {
      console.error('Error checking connections:', error);
    }
  }

  async manualReconnect(): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      this.isReconnecting.next(true);
      const result = await this.electronService.ipcRenderer.invoke(
        'reconnect-database'
      );

      if (!result.success) {
        this.errorMessage.next(
          result.error || 'Failed to reconnect to database'
        );
      } else {
        this.errorMessage.next('');
      }
    } catch (error) {
      this.errorMessage.next(error.message || 'Error reconnecting to database');
    } finally {
      this.isReconnecting.next(false);
    }
  }

  async getProductSyncStatus(): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      const status = await this.electronService.ipcRenderer.invoke(
        'get-product-sync-status'
      );
      this.pendingProductSyncs.next(status.pendingUploads);
    } catch (error) {
      console.error('Error getting product sync status:', error);
    }
  }
}
