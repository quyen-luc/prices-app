import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DialogBaseComponent } from '../../abstracts/dialog-base.component';
import { Subscription } from 'rxjs';
import { ElectronService } from '../../../core/services';
import { FirstRunService } from '../../../core/services/first-run.service';

/**
 * First Run Dialog Component
 * Handles the entire first run process, including welcome, progress, completion, and error states
 */
@Component({
  selector: 'app-first-run-dialog',
  templateUrl: './first-run-dialog.component.html',
  styleUrls: ['./first-run-dialog.component.scss'],
})
export class FirstRunDialogComponent
  extends DialogBaseComponent<any, string>
  implements OnInit, OnDestroy
{


  /**
   * Current state of the first run process
   */
  state: 'welcome' | 'progress' | 'complete' | 'error' = 'welcome';

  /**
   * Progress information
   */
  progress = { count: 0, total: null };

  /**
   * Completion data
   */
  downloadedCount = 0;

  /**
   * Error message
   */
  errorMessage = '';

  /**
   * Subscriptions to clean up
   */
  private subscriptions: Subscription[] = [];

  constructor(
    private electronService: ElectronService,
    private cdr: ChangeDetectorRef,
    private firstRunService: FirstRunService,
  ) {
    super();
  }

  ngOnInit(): void {


    if (this.electronService.isElectron) {
      // Listen for completion
      this.electronService.ipcRenderer.on(
        'first-run-sync-complete',
        (_event, data) => {
          if (!data.skipped) {
            this.downloadedCount = data.downloaded;
            this.state = 'complete';
          } else {
            this.close('skip');
          }
          this.cdr.detectChanges();
        }
      );

      // Listen for errors
      this.electronService.ipcRenderer.on(
        'first-run-sync-error',
        (_event, data) => {
          this.errorMessage = data.message;
          this.state = 'error';
          this.cdr.detectChanges();
        }
      );

      this.electronService.ipcRenderer.on(
        'sync-progress-update',
        (_event, data) => {
          this.progress.count = data.count;
          this.progress.total = data.total || null;
          this.state = 'progress';

          this.cdr.detectChanges();
        }
      );
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());

    // Remove IPC listeners
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.removeAllListeners(
        'first-run-sync-complete'
      );
      this.electronService.ipcRenderer.removeAllListeners(
        'first-run-sync-error'
      );
    }
  }

  /**
   * Handle the start sync button click
   */
  startSync(): void {
    this.state = 'progress';
    this.electronService.ipcRenderer.send('first-run-sync-start');
  }

  /**
   * Handle the skip sync button click
   */
  skipSync(): void {
    this.electronService.ipcRenderer.send('first-run-sync-skip');
    this.close('skip');
  }

  /**
   * Finish the dialog process
   */
  finishProcess(): void {
    this.close('done');
  }
}
