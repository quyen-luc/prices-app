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
exports.ConnectionMonitor = void 0;
const electron_1 = require("electron");
const dns = require("dns");
const remote_database_1 = require("../database/remote-database");
const connectionEvents = require("../constants/connection-events");
/**
 * ConnectionMonitor class that handles checking internet connectivity
 * and database connection status, with automatic reconnection attempts
 */
class ConnectionMonitor {
    constructor() {
        this.isInternetConnected = true;
        this.isDbConnected = true;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5;
        this.RECONNECT_INTERVAL = 5000; // 5 seconds
        this.CONNECTIVITY_CHECK_INTERVAL = 10000; // 10 seconds
        this.internetCheckTimer = null;
        this.reconnectTimer = null;
        this.mainWindow = null;
    }
    setWindow(window) {
        this.mainWindow = window;
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ConnectionMonitor.instance) {
            ConnectionMonitor.instance = new ConnectionMonitor();
        }
        return ConnectionMonitor.instance;
    }
    /**
     * Initialize connection monitoring
     */
    init(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupIpcHandlers();
        this.startInternetMonitoring();
        this.checkDbConnection();
    }
    /**
     * Set up IPC handlers for renderer process to request connection status checks
     */
    setupIpcHandlers() {
        electron_1.ipcMain.handle(connectionEvents.CHECK_INTERNET_CONNECTION, () => __awaiter(this, void 0, void 0, function* () {
            return { connected: yield this.checkInternetConnection() };
        }));
        electron_1.ipcMain.handle(connectionEvents.CHECK_DB_CONNECTION, () => __awaiter(this, void 0, void 0, function* () {
            return { connected: yield this.checkDbConnection() };
        }));
        electron_1.ipcMain.handle(connectionEvents.RECONNECT_DATABASE, () => __awaiter(this, void 0, void 0, function* () {
            return this.reconnectDatabase();
        }));
    }
    /**
     * Start monitoring internet connectivity
     */
    startInternetMonitoring() {
        // Perform initial check
        this.checkInternetConnection();
        // Set up periodic checks
        this.internetCheckTimer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.checkInternetConnection();
        }), this.CONNECTIVITY_CHECK_INTERVAL);
    }
    /**
     * Check internet connection by performing a DNS lookup
     */
    checkInternetConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Use DNS resolution to check internet connectivity
                // Try to resolve a reliable domain like Google DNS
                return new Promise((resolve) => {
                    dns.resolve('8.8.8.8', (err) => {
                        const isConnected = !err;
                        // Only handle state changes
                        if (this.isInternetConnected !== isConnected) {
                            this.isInternetConnected = isConnected;
                            this.notifyConnectionStatus();
                            // If internet is restored, check database connectivity
                            if (isConnected && !this.isDbConnected) {
                                this.checkDbConnection();
                            }
                        }
                        resolve(isConnected);
                    });
                });
            }
            catch (error) {
                console.error('Error checking internet connection:', error);
                this.isInternetConnected = false;
                this.notifyConnectionStatus();
                return false;
            }
        });
    }
    /**
     * Check database connection
     */
    checkDbConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const remoteDb = remote_database_1.RemoteDatabase.getInstance();
                // Check if database is connected or can be connected
                const isConnected = yield remoteDb.checkHealth();
                // Handle state changes
                if (this.isDbConnected !== isConnected) {
                    this.isDbConnected = isConnected;
                    this.notifyConnectionStatus();
                    // If database connection is lost but internet is available, 
                    // start reconnection attempts
                    if (!isConnected && this.isInternetConnected) {
                        this.startReconnectionAttempts();
                    }
                }
                return isConnected;
            }
            catch (error) {
                console.error('Error checking database connection:', error);
                this.isDbConnected = false;
                this.notifyConnectionStatus();
                // Start reconnection if internet is available
                if (this.isInternetConnected) {
                    this.startReconnectionAttempts();
                }
                return false;
            }
        });
    }
    /**
     * Start database reconnection attempts
     */
    startReconnectionAttempts() {
        // Reset reconnect attempts counter if this is a new reconnection sequence
        if (!this.reconnectTimer) {
            this.reconnectAttempts = 0;
        }
        // Clear any existing timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // Attempt reconnection if under the max attempts
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            this.notifyReconnectingStatus(true);
            this.reconnectTimer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.reconnectDatabase();
                if (!result.success) {
                    // If failed, schedule another attempt
                    this.startReconnectionAttempts();
                }
                else {
                    // If successful, reset the counter and timer
                    this.reconnectAttempts = 0;
                    this.reconnectTimer = null;
                    this.notifyReconnectingStatus(false);
                }
            }), this.RECONNECT_INTERVAL);
        }
        else {
            // Max attempts reached, stop trying
            this.reconnectTimer = null;
            this.notifyReconnectingStatus(false);
            this.notifyConnectionStatus({
                error: `Failed to reconnect after ${this.MAX_RECONNECT_ATTEMPTS} attempts. Please check your network or database configuration.`
            });
        }
    }
    /**
     * Attempt to reconnect to the database
     */
    reconnectDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const remoteDb = remote_database_1.RemoteDatabase.getInstance();
                // If already connected, nothing to do
                if (yield remoteDb.checkHealth()) {
                    this.isDbConnected = true;
                    this.notifyConnectionStatus();
                    return { success: true };
                }
                // Check internet connectivity first
                if (!(yield this.checkInternetConnection())) {
                    return {
                        success: false,
                        error: 'No internet connection available. Please check your network.'
                    };
                }
                // Try to reconnect
                yield remoteDb.disconnect(); // Ensure clean state
                yield remoteDb.connect();
                // Verify connection
                const isConnected = yield remoteDb.checkHealth();
                this.isDbConnected = isConnected;
                this.notifyConnectionStatus();
                return isConnected
                    ? { success: true }
                    : { success: false, error: 'Failed to establish database connection.' };
            }
            catch (error) {
                console.error('Error reconnecting to database:', error);
                this.isDbConnected = false;
                this.notifyConnectionStatus({ error: error.message });
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Notify the renderer process about connection status
     */
    notifyConnectionStatus(additionalInfo = {}) {
        if (!this.mainWindow)
            return;
        this.mainWindow.webContents.send(connectionEvents.DB_CONNECTION_STATUS, Object.assign({ connected: this.isDbConnected, internetConnected: this.isInternetConnected }, additionalInfo));
    }
    /**
     * Notify the renderer process about reconnection attempts
     */
    notifyReconnectingStatus(isReconnecting) {
        if (!this.mainWindow)
            return;
        this.mainWindow.webContents.send(connectionEvents.DB_RECONNECTING_STATUS, {
            reconnecting: isReconnecting,
            attemptNumber: this.reconnectAttempts,
            maxAttempts: this.MAX_RECONNECT_ATTEMPTS
        });
    }
    /**
     * Stop all monitoring and timers
     */
    stop() {
        if (this.internetCheckTimer) {
            clearInterval(this.internetCheckTimer);
            this.internetCheckTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
exports.ConnectionMonitor = ConnectionMonitor;
// Export singleton instance
exports.default = ConnectionMonitor.getInstance();
//# sourceMappingURL=connection-monitor.service.js.map