import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import productSyncService from './product-sync.service';

class FirstRunService {
  private browserWindow: BrowserWindow = null;
  private syncInProgress = false;

  
  setWindow(window: BrowserWindow): void {
    this.browserWindow = window;
  }

  /**
   * Initialize the first run service
   * @param window The main browser window
   */
  public init(window: BrowserWindow): void {
    this.browserWindow = window;

    // Check if this is the first run when the app is ready
    this.browserWindow.webContents.on('did-finish-load', async () => {
      const firstRun = await this.isFirstRun();
      if (firstRun) {
        console.log('First run detected - performing initial data sync');
        // Wait briefly for the UI to fully initialize
        setTimeout(() => this.sendToAngular('show-first-run-dialog'), 1500);
      }
    });

    // Set up IPC handlers for Angular communication
    const { ipcMain } = require('electron');
    
    ipcMain.on('first-run-sync-start', async () => {
      await this.startProductSync();
    });

    ipcMain.on('first-run-sync-skip', async () => {
      await this.markFirstRunComplete();
    });
  }

  /**
   * Checks if this is the first time the app has been run
   * @returns Promise<boolean> True if this is the first run
   */
  public async isFirstRun(): Promise<boolean> {
    const userDataPath = app.getPath('userData');
    const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');

    // If the flag file doesn't exist, this is the first run
    if (!fs.existsSync(firstRunFlagPath)) {
      return true;
    }

    return false;
  }

  /**
   * Mark first run as complete by creating a flag file
   */
  private async markFirstRunComplete(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');

    // Create the flag file with current timestamp
    fs.writeFileSync(firstRunFlagPath, new Date().toISOString());
    console.log('First run completed - created flag file');
  }

  /**
   * Send message to Angular application
   */
  private sendToAngular(channel: string, data: any = {}): void {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.webContents.send(channel, data);''
    }
  }

  /**
   * Start the product sync process
   */
  private async startProductSync(): Promise<void> {
    try {
      this.syncInProgress = true;
      
      // Set up IPC handler for sync progress
      const { ipcMain } = require('electron');
      let downloadedCount = 0;
      
      // Track progress
      const progressHandler = (event, data) => {
        if (data.count) {
          downloadedCount += data.count;
          // Forward progress to Angular
          this.sendToAngular('first-run-sync-progress', {
            count: downloadedCount,
            total: data.total,
          });
        }
      };
      
      // Listen for sync progress events from product sync service
      ipcMain.on('sync-progress', progressHandler);

      // Trigger a full sync using the product sync service
      const syncResult = await productSyncService.pullRemoteProducts();

      // Remove IPC listener
      ipcMain.removeListener('sync-progress', progressHandler);

      // Send final count
      this.sendToAngular('first-run-sync-progress', {
        count: syncResult.downloaded,
        total: syncResult.downloaded,
        complete: true
      });

      // Mark first run as complete
      await this.markFirstRunComplete();

      // Signal completion to Angular
      this.sendToAngular('first-run-sync-complete', { 
        success: true, 
        downloaded: syncResult.downloaded 
      });

      console.log('Initial data sync completed successfully');
    } catch (error) {
      console.error('Error during initial data sync:', error);

      // Signal error to Angular
      this.sendToAngular('first-run-sync-error', { 
        message: error.message || 'An unknown error occurred' 
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Reset the first run state - useful for debugging
   */
  public async resetFirstRunState(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');

    if (fs.existsSync(firstRunFlagPath)) {
      fs.unlinkSync(firstRunFlagPath);
      console.log('First run flag reset - next app start will trigger initial sync');
      
      this.sendToAngular('first-run-reset-success');
    } else {
      this.sendToAngular('first-run-already-pending');
    }
  }

  /**
   * Clean up resources when the app is closing
   */
  public stop(): void {
    this.browserWindow = null;
  }
}

// Create singleton instance
const firstRunService = new FirstRunService();
export default firstRunService;