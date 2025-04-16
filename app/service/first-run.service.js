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
                setTimeout(() => this.sendToAngular('show-first-run-dialog'), 1500);
            }
        }));
        // Set up IPC handlers for Angular communication
        const { ipcMain } = require('electron');
        ipcMain.on('first-run-sync-start', () => __awaiter(this, void 0, void 0, function* () {
            yield this.startProductSync();
        }));
        ipcMain.on('first-run-sync-skip', () => __awaiter(this, void 0, void 0, function* () {
            yield this.markFirstRunComplete();
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
            // Create the flag file with current timestamp
            fs.writeFileSync(firstRunFlagPath, new Date().toISOString());
            console.log('First run completed - created flag file');
        });
    }
    /**
     * Send message to Angular application
     */
    sendToAngular(channel, data = {}) {
        if (this.browserWindow && !this.browserWindow.isDestroyed()) {
            this.browserWindow.webContents.send(channel, data);
            '';
        }
    }
    /**
     * Start the product sync process
     */
    startProductSync() {
        return __awaiter(this, void 0, void 0, function* () {
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
                const syncResult = yield product_sync_service_1.default.pullRemoteProducts();
                // Remove IPC listener
                ipcMain.removeListener('sync-progress', progressHandler);
                // Send final count
                this.sendToAngular('first-run-sync-progress', {
                    count: syncResult.downloaded,
                    total: syncResult.downloaded,
                    complete: true
                });
                // Mark first run as complete
                yield this.markFirstRunComplete();
                // Signal completion to Angular
                this.sendToAngular('first-run-sync-complete', {
                    success: true,
                    downloaded: syncResult.downloaded
                });
                console.log('Initial data sync completed successfully');
            }
            catch (error) {
                console.error('Error during initial data sync:', error);
                // Signal error to Angular
                this.sendToAngular('first-run-sync-error', {
                    message: error.message || 'An unknown error occurred'
                });
            }
            finally {
                this.syncInProgress = false;
            }
        });
    }
    /**
     * Reset the first run state - useful for debugging
     */
    resetFirstRunState() {
        return __awaiter(this, void 0, void 0, function* () {
            const userDataPath = electron_1.app.getPath('userData');
            const firstRunFlagPath = path.join(userDataPath, '.first-run-complete');
            if (fs.existsSync(firstRunFlagPath)) {
                fs.unlinkSync(firstRunFlagPath);
                console.log('First run flag reset - next app start will trigger initial sync');
                this.sendToAngular('first-run-reset-success');
            }
            else {
                this.sendToAngular('first-run-already-pending');
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