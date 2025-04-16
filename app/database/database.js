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
exports.setupDatabaseIpcHandlers = exports.setupDatabaseHealthCheck = exports.checkDatabaseConnection = exports.reconnectDatabase = exports.closeDatabase = exports.getDataSource = exports.initializeDatabase = exports.LocalDatabase = void 0;
const electron_1 = require("electron");
const path = require("path");
const typeorm_1 = require("typeorm");
const electron_2 = require("electron");
const product_entity_1 = require("../entities/product.entity");
class LocalDatabase {
    constructor() {
        this.isInitializing = false;
        this.initPromise = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000; // 1 second initial delay
        this.reconnectTimer = null;
    }
    static getInstance() {
        if (!LocalDatabase.instance) {
            LocalDatabase.instance = new LocalDatabase();
        }
        return LocalDatabase.instance;
    }
    getLocalDbConfig() {
        const userDataPath = electron_1.app.getPath('userData');
        console.log('User Data Path:', userDataPath);
        return {
            type: 'better-sqlite3',
            database: path.join(userDataPath, 'product-database.db'),
            entities: [product_entity_1.ProductEntity],
            synchronize: true,
            dropSchema: true,
            logging: process.env.NODE_ENV === 'development',
        };
    }
    initializeDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dataSource && this.dataSource.isInitialized) {
                return this.dataSource;
            }
            if (this.isInitializing && this.initPromise) {
                return this.initPromise;
            }
            this.isInitializing = true;
            try {
                this.initPromise = (() => __awaiter(this, void 0, void 0, function* () {
                    const config = this.getLocalDbConfig();
                    this.dataSource = new typeorm_1.DataSource(config);
                    yield this.dataSource.initialize();
                    this.reconnectAttempts = 0;
                    console.log('Local database connection established');
                    return this.dataSource;
                }))();
                yield this.initPromise;
                return this.dataSource;
            }
            catch (error) {
                console.error('Error connecting to local database:', error);
                throw error;
            }
        });
    }
    getDataSource() {
        if (!this.dataSource || !this.dataSource.isInitialized) {
            throw new Error('Database connection not initialized');
        }
        return this.dataSource;
    }
    closeDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dataSource && this.dataSource.isInitialized) {
                yield this.dataSource.destroy();
                console.log('Local database connection closed');
            }
        });
    }
    checkConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.dataSource || !this.dataSource.isInitialized) {
                return false;
            }
            try {
                yield this.dataSource.query('SELECT 1');
                return true;
            }
            catch (error) {
                console.error('Database health check failed:', error);
                return false;
            }
        });
    }
    reconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.reconnectAttempts) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // Check if max attempts reached
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                const error = new Error(`Failed to reconnect to database after ${this.maxReconnectAttempts} attempts`);
                console.error(error);
                throw error;
            }
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponentia
            console.log(`Attempting database reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            yield new Promise((resolve) => {
                this.reconnectTimer = setTimeout(resolve, delay);
            });
            if (this.dataSource) {
                return;
            }
            return this.initializeDatabase();
        });
    }
}
exports.LocalDatabase = LocalDatabase;
const initializeDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    return LocalDatabase.getInstance().initializeDatabase();
});
exports.initializeDatabase = initializeDatabase;
const getDataSource = () => {
    return LocalDatabase.getInstance().getDataSource();
};
exports.getDataSource = getDataSource;
const closeDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    return LocalDatabase.getInstance().closeDatabase();
});
exports.closeDatabase = closeDatabase;
const reconnectDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    return LocalDatabase.getInstance().reconnect();
});
exports.reconnectDatabase = reconnectDatabase;
const checkDatabaseConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    return LocalDatabase.getInstance().checkConnection();
});
exports.checkDatabaseConnection = checkDatabaseConnection;
let healthCheckInterval = null;
/**
* Set up periodic database health checks
*/
function setupDatabaseHealthCheck(win) {
    // Clear any existing interval
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    // Check database health every 30 seconds
    healthCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        try {
            const isConnected = yield (0, exports.checkDatabaseConnection)();
            if (!isConnected) {
                console.log('Database connection lost, attempting to reconnect...');
                // Notify renderer about connection issue
                if (win && !win.isDestroyed()) {
                    win.webContents.send('db-connection-status', { connected: false });
                }
                // Attempt to reconnect
                yield (0, exports.reconnectDatabase)();
                // Notify renderer about successful reconnection
                if (win && !win.isDestroyed()) {
                    win.webContents.send('db-connection-status', { connected: true });
                }
                console.log('Database reconnection successful');
            }
        }
        catch (error) {
            console.error('Health check failed:', error);
            // If win is still available, notify renderer about continued connection issues
            if (win && !win.isDestroyed()) {
                win.webContents.send('db-connection-status', {
                    connected: false,
                    error: error.message
                });
            }
        }
    }), 30000); // 30 seconds
}
exports.setupDatabaseHealthCheck = setupDatabaseHealthCheck;
function setupDatabaseIpcHandlers() {
    electron_2.ipcMain.handle('check-db-connection', () => __awaiter(this, void 0, void 0, function* () {
        try {
            const isConnected = yield (0, exports.checkDatabaseConnection)();
            return { connected: isConnected };
        }
        catch (error) {
            return { connected: false, error: error.message };
        }
    }));
    electron_2.ipcMain.handle('reconnect-database', () => __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, exports.reconnectDatabase)();
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }));
}
exports.setupDatabaseIpcHandlers = setupDatabaseIpcHandlers;
//# sourceMappingURL=database.js.map