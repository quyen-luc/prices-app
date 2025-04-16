import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { DialogService } from '../../shared/services/dialog.service';
import { FirstRunDialogComponent } from '../../shared/components/first-run-dialog/first-run-dialog.component';
import { ElectronService } from './electron/electron.service';

@Injectable({
  providedIn: 'root'
})
export class FirstRunService {
  private syncProgress = new BehaviorSubject<{count: number, total: number | null, complete?: boolean}>({count: 0, total: null});
  public syncProgress$ = this.syncProgress.asObservable();
  public loadDialog$ = new Subject<void>();
  
  constructor(
    private electronService: ElectronService,
    private dialogService: DialogService
  ) {
    // Initialize IPC listeners
    this.initializeListeners();
  }
  
  /**
   * Initialize IPC listeners for first run events
   */
  private initializeListeners(): void {
    if (this.electronService.isElectron) {
      // Listen for show dialog command
      this.electronService.ipcRenderer.on('show-first-run-dialog', () => {
        this.showFirstRunDialog();
        this.loadDialog$.next();
      });
      
      // Listen for progress updates
      this.electronService.ipcRenderer.on('first-run-sync-progress', (_event, data) => {
        this.syncProgress.next(data);
      });
    }
  }
  
  /**
   * Show the first run dialog
   */
  public showFirstRunDialog(): void {
    const dialogRef = this.dialogService.open(FirstRunDialogComponent, {
      disableClose: true,
      // Pass any data needed for the dialog
      data: {
        progress$: this.syncProgress$
      }
    });
    
    dialogRef.afterClosed.subscribe(result => {
      console.log('First run dialog closed with result:', result);
    });
  }
  
  /**
   * Manually reset first run state (for testing)
   */
  public resetFirstRunState(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('reset-first-run-state');
    }
  }
}