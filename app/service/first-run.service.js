"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
const product_sync_service_1 = require("./product-sync.service");
class FirstRunService {
    constructor() {
        this.browserWindow = null;
        this.syncInProgress = false;
    }
    /**
     * Initialize the first run service
     * @param window The main browser window
     */
    init(window) {
        this.browserWindow = window;
        // Check if this is the first run when the app is ready
        this.browserWindow.webContents.on('did-finish-load', () => __awaiter(this, void 0, void 0, function* () {
            const firstRun = yield this.isFirstRun();
            if (firstRun) {
                console.log('First run detected - performing initial data sync');
                // Wait briefly for the UI to fully initialize
                setTimeout(() => this.performInitialSync(), 1500);
            }
        }));
    }
    /**
     * Checks if this is the first time the app has been run
     * @returns Promise<boolean> True if this is the first run
     */
    isFirstRun() {
        return __awaiter(this, void 0, void 0, function* () {
            const userDataPath = electron_1.app.getPath('userData');
            const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');
            // If the flag file doesn't exist, this is the first run
            if (!fs.existsSync(firstRunFlagPath)) {
                return true;
            }
            return false;
        });
    }
    /**
     * Mark first run as complete by creating a flag file
     */
    markFirstRunComplete() {
        return __awaiter(this, void 0, void 0, function* () {
            const userDataPath = electron_1.app.getPath('userData');
            const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');
            console.log(firstRunFlagPath);
            // Create the flag file with current timestamp
            fs.writeFileSync(firstRunFlagPath, new Date().toISOString());
            console.log('First run completed - created flag file');
        });
    }
    /**
     * Perform initial data synchronization using native dialogs
     */
    performInitialSync() {
        return __awaiter(this, void 0, void 0, function* () {
            // Guard against multiple syncs
            if (this.syncInProgress) {
                return;
            }
            console.log('Performing initial data sync...');
            // Show an informational dialog to the user
            const startDialog = yield electron_1.dialog.showMessageBox(this.browserWindow, {
                type: 'info',
                title: 'First Run Setup',
                message: 'Welcome to the application!',
                detail: 'We need to download initial data. This may take several minutes. Would you like to proceed?',
                buttons: ['Download Data', 'Skip'],
                defaultId: 0,
                cancelId: 1,
            });
            // If user chooses to skip, we'll mark first run as complete anyway
            if (startDialog.response === 1) {
                console.log('User chose to skip initial data download');
                yield this.markFirstRunComplete();
                return;
            }
            try {
                // Create a simple progress window
                const progressWindow = new electron_1.BrowserWindow({
                    parent: this.browserWindow,
                    width: 400,
                    height: 250,
                    frame: true,
                    resizable: false,
                    minimizable: false,
                    maximizable: false,
                    closable: false,
                    alwaysOnTop: true,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false,
                        devTools: false,
                    },
                });
                // Load a minimal HTML page with progress message and three-dot loading animation
                progressWindow.loadURL('data:text/html,' +
                    encodeURIComponent(`
<html>
  <head>
    <style>
      body {
        font-family: -apple-system, system-ui, sans-serif;
        padding: 20px;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: calc(100vh - 40px);
        background-color: #f8f8f8;
      }
      h3 {
        margin-bottom: 20px;
        color: #333;
      }
      p {
        margin-top: 15px;
        color: #666;
      }
      .loading:after {
        content: '.';
        animation: dots 1.5s steps(5, end) infinite;
      }
      
      @keyframes dots {
        0%, 20% {
          color: rgba(0,0,0,0);
          text-shadow:
            .25em 0 0 rgba(0,0,0,0),
            .5em 0 0 rgba(0,0,0,0);
        }
        40% {
          color: #666;
          text-shadow:
            .25em 0 0 rgba(0,0,0,0),
            .5em 0 0 rgba(0,0,0,0);
        }
        60% {
          text-shadow:
            .25em 0 0 #666,
            .5em 0 0 rgba(0,0,0,0);
        }
        80%, 100% {
          text-shadow:
            .25em 0 0 #666,
            .5em 0 0 #666;
        }
      }
    </style>
  </head>
  <body>
    <h3>Downloading Data</h3>
    <p>Initial data synchronization in progress<span class="loading"></span></p>
  </body>
</html>
`));
                progressWindow.setMenu(null);
                progressWindow.center();
                // Trigger a full sync using the product sync service
                const syncResult = yield product_sync_service_1.default.pullRemoteProducts();
                progressWindow.destroy();
                // Mark first run as complete
                yield this.markFirstRunComplete();
                // Show completion dialog
                yield electron_1.dialog.showMessageBox(this.browserWindow, {
                    type: 'info',
                    title: 'Setup Complete',
                    message: 'Initial data synchronization completed successfully.',
                    detail: `Downloaded ${syncResult.downloaded} products. You can now start using the application.`,
                    buttons: ['OK'],
                });
                console.log('Initial data sync completed successfully');
            }
            catch (error) {
                console.error('Error during initial data sync:', error);
                // Show error dialog
                yield electron_1.dialog.showMessageBox(this.browserWindow, {
                    type: 'error',
                    title: 'Sync Error',
                    message: 'Failed to perform initial data synchronization',
                    detail: error.message || 'An unknown error occurred.',
                    buttons: ['OK'],
                });
            }
            finally {
                this.syncInProgress = false;
            }
        });
    }
    /**
     * Manually trigger initial sync - useful for retry from UI
     */
    triggerInitialSync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.performInitialSync();
        });
    }
    /**
     * Reset the first run state - useful for debugging or forcing a resync
     */
    resetFirstRunState() {
        return __awaiter(this, void 0, void 0, function* () {
            const userDataPath = electron_1.app.getPath('userData');
            const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');
            if (fs.existsSync(firstRunFlagPath)) {
                fs.unlinkSync(firstRunFlagPath);
                console.log('First run flag reset - next app start will trigger initial sync');
                yield electron_1.dialog.showMessageBox(this.browserWindow, {
                    type: 'info',
                    title: 'First Run Reset',
                    message: 'First run state has been reset.',
                    detail: 'The next time you start the application, it will perform initial setup again.',
                    buttons: ['OK'],
                });
            }
            else {
                yield electron_1.dialog.showMessageBox(this.browserWindow, {
                    type: 'info',
                    title: 'First Run Reset',
                    message: 'First run is already pending.',
                    detail: 'The application is already set to perform initial setup on next start.',
                    buttons: ['OK'],
                });
            }
        });
    }
    /**
     * Clean up resources when the app is closing
     */
    stop() {
        this.browserWindow = null;
    }
}
// Create singleton instance
const firstRunService = new FirstRunService();
exports.default = firstRunService;
//# sourceMappingURL=first-run.service.js.map