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
exports.getRemoteConnection = exports.getRemoteDataSource = exports.isRemoteConnected = exports.closeRemoteConnection = exports.connectToRemoteDb = exports.getAwsCredentials = exports.setAwsCredentials = exports.RemoteDatabase = void 0;
const typeorm_1 = require("typeorm");
const config_manager_1 = require("../config/config-manager");
const product_entity_1 = require("../entities/postgresql/product.entity");
/**
 * RemoteDatabase class for managing PostgreSQL connection
 * Implements Singleton pattern to ensure a single connection instance
 */
class RemoteDatabase {
    /**
     * Private constructor to prevent direct instantiation
     */
    constructor() {
        this.dataSource = null;
        this.isInitializing = false;
        this.initPromise = null;
        // Default credentials - in production, consider loading from environment variables or secure storage
        this.credentials = null;
        this.credentials = (0, config_manager_1.getRemoteDbCredentials)();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!RemoteDatabase.instance) {
            RemoteDatabase.instance = new RemoteDatabase();
        }
        return RemoteDatabase.instance;
    }
    /**
     * Set AWS credentials
     */
    setCredentials(credentials) {
        this.credentials = credentials;
        // If already connected, we may want to reconnect with new credentials
        if (this.isConnected()) {
            console.log('Credentials updated. You may need to reconnect for changes to take effect.');
        }
    }
    /**
     * Get current AWS credentials
     */
    getCredentials() {
        return Object.assign({}, this.credentials); // Return a copy to prevent modification
    }
    /**
     * Get database configuration
     */
    getConfig() {
        if (!this.credentials) {
            throw new Error('AWS credentials not set');
        }
        return {
            type: 'postgres',
            host: this.credentials.host,
            port: this.credentials.port,
            username: this.credentials.username,
            password: this.credentials.password,
            database: this.credentials.database,
            entities: [product_entity_1.ProductEntity],
            synchronize: true, // Should be false in production
            ssl: true,
            extra: {
                ssl: {
                    rejectUnauthorized: false // For development - adjust for production
                }
            }
        };
    }
    /**
     * Connect to the remote database
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            // Return existing connection if available
            if (this.dataSource && this.dataSource.isInitialized) {
                return this.dataSource;
            }
            // Return existing initialization promise if in progress
            if (this.isInitializing && this.initPromise) {
                return this.initPromise;
            }
            this.isInitializing = true;
            // Create and store the initialization promise
            this.initPromise = (() => __awaiter(this, void 0, void 0, function* () {
                try {
                    const config = this.getConfig();
                    this.dataSource = new typeorm_1.DataSource(config);
                    yield this.dataSource.initialize();
                    console.log('Remote database connection established');
                    return this.dataSource;
                }
                catch (error) {
                    console.error('Error connecting to remote database:', error);
                    this.dataSource = null;
                    throw error;
                }
                finally {
                    this.isInitializing = false;
                }
            }))();
            return this.initPromise;
        });
    }
    /**
     * Check if connected to remote database
     */
    isConnected() {
        return !!(this.dataSource && this.dataSource.isInitialized);
    }
    /**
     * Get the data source
     */
    getDataSource() {
        if (!this.dataSource || !this.dataSource.isInitialized) {
            throw new Error('Remote database connection not initialized. Call connect() first.');
        }
        return this.dataSource;
    }
    /**
     * Close database connection
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dataSource && this.dataSource.isInitialized) {
                yield this.dataSource.destroy();
                this.dataSource = null;
                console.log('Remote database connection closed');
            }
        });
    }
    /**
     * Check connection health
     */
    checkHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.dataSource || !this.dataSource.isInitialized) {
                return false;
            }
            try {
                // Simple query to verify connection
                yield this.dataSource.query('SELECT 1');
                return true;
            }
            catch (error) {
                console.error('Remote database health check failed:', error);
                return false;
            }
        });
    }
}
exports.RemoteDatabase = RemoteDatabase;
// Convenience functions for backward compatibility and easier access
const setAwsCredentials = (credentials) => {
    RemoteDatabase.getInstance().setCredentials(credentials);
};
exports.setAwsCredentials = setAwsCredentials;
const getAwsCredentials = () => {
    return RemoteDatabase.getInstance().getCredentials();
};
exports.getAwsCredentials = getAwsCredentials;
const connectToRemoteDb = () => __awaiter(void 0, void 0, void 0, function* () {
    return RemoteDatabase.getInstance().connect();
});
exports.connectToRemoteDb = connectToRemoteDb;
const closeRemoteConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    return RemoteDatabase.getInstance().disconnect();
});
exports.closeRemoteConnection = closeRemoteConnection;
const isRemoteConnected = () => {
    return RemoteDatabase.getInstance().isConnected();
};
exports.isRemoteConnected = isRemoteConnected;
const getRemoteDataSource = () => {
    return RemoteDatabase.getInstance().getDataSource();
};
exports.getRemoteDataSource = getRemoteDataSource;
// For backwards compatibility
const getRemoteConnection = () => {
    return (0, exports.getRemoteDataSource)();
};
exports.getRemoteConnection = getRemoteConnection;
//# sourceMappingURL=remote-database.js.map