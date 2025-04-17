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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSyncService = void 0;
const electron_1 = require("electron");
const typeorm_1 = require("typeorm");
const connectionEvents = require("../constants/connection-events");
const sync_event_1 = require("../constants/sync-event");
const connection_monitor_service_1 = require("./connection-monitor.service");
const database_1 = require("../database/database");
const remote_database_1 = require("../database/remote-database");
const app_identity_service_1 = require("../config/app-identity.service");
const product_entity_1 = require("../entities/postgresql/product.entity");
const utils_1 = require("../utils/utils");
class ProductSyncService {
    constructor() {
        this.isSyncing = false;
        this.autoSyncEnabled = false;
        this.syncInterval = null;
        this.SYNC_INTERVAL_MS = 60000; // 1 minute
        this.mainWindow = null;
    }
    static getInstance() {
        if (!ProductSyncService.instance) {
            ProductSyncService.instance = new ProductSyncService();
        }
        return ProductSyncService.instance;
    }
    setWindow(window) {
        this.mainWindow = window;
    }
    init(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupIpcHandlers();
        this.appId = app_identity_service_1.AppIdentityService.getInstance().getAppId();
        console.log(`Product Sync Service initialized with App ID: ${this.appId}`);
        electron_1.ipcMain.on(connectionEvents.DB_CONNECTION_STATUS, (event, status) => {
            if (status.connected && this.autoSyncEnabled) {
                console.log('Database connected, starting auto-sync...');
                this.startAutoSync();
            }
        });
    }
    setupIpcHandlers() {
        electron_1.ipcMain.handle(sync_event_1.SYNC_EVENT.SYNC_PRODUCTS, (event, enable) => {
            return this.syncProducts();
        });
        electron_1.ipcMain.handle(sync_event_1.SYNC_EVENT.PULL_REMOTE_PRODUCTS, (event, enable) => {
            return this.pullRemoteProducts();
        });
        electron_1.ipcMain.handle(sync_event_1.SYNC_EVENT.GET_PRODUCT_SYNC_STATUS, (event) => {
            return this.getProductSyncStatus();
        });
        electron_1.ipcMain.handle(sync_event_1.SYNC_EVENT.TOGGLE_PRODUCT_AUTO_SYNC, (event, enabled) => {
            this.autoSyncEnabled = enabled;
            if (enabled) {
                this.startAutoSync();
            }
            else {
                this.stopAutoSync();
            }
            return { autoSyncEnabled: this.autoSyncEnabled };
        });
    }
    startAutoSync() {
        this.syncInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            console.log('Auto-syncing products...');
            const connectionMonitor = connection_monitor_service_1.ConnectionMonitor.getInstance();
            const dbStatus = yield connectionMonitor.checkDbConnection();
            if (dbStatus) {
                this.syncProducts();
            }
        }), this.SYNC_INTERVAL_MS);
    }
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    getProductSyncStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const localDb = yield database_1.LocalDatabase.getInstance().getDataSource();
                // Get count of locally modified products
                const pendingUploadsResult = yield localDb
                    .createQueryBuilder()
                    .select('COUNT(*)', 'count')
                    .from('products', 'p')
                    .where('isModifiedLocally = 1 AND deletedAt is NULL')
                    .getRawOne();
                const pendingUploads = parseInt(pendingUploadsResult.count, 10);
                // Get last sync time for UI display
                const lastSyncResult = yield localDb
                    .createQueryBuilder()
                    .select('MAX(lastSyncedAt)', 'lastSync')
                    .from('products', 'p')
                    .getRawOne();
                const lastSyncedAt = lastSyncResult.lastSync
                    ? new Date(lastSyncResult.lastSync)
                    : null;
                let pendingDownloads = 0;
                const remoteDb = remote_database_1.RemoteDatabase.getInstance();
                if (yield remoteDb.checkHealth()) {
                    try {
                        // Get the formatted timestamp for the query
                        // Fix the SQL syntax error in the query
                        // Count products that either:
                        // 1. Don't have this app ID in their syncedIds array, OR
                        // 2. Have been updated after the last sync time and are already synced with this app
                        const remoteResult = yield remoteDb.getDataSource().query(`
              SELECT COUNT(*) as count 
              FROM products 
              WHERE 
                (
                "syncedIds" IS NULL OR
                NOT($1 = ANY("syncedIds")) OR ($1 = ANY("syncedIds") AND "updatedAt" > $2))
                AND "deletedAt" IS NULL
            `, [this.appId, lastSyncedAt]);
                        pendingDownloads = parseInt(remoteResult[0].count, 10);
                        // Also count deleted products not yet synced
                        const remoteDeletedResult = yield remoteDb.getDataSource().query(`
              SELECT COUNT(*) as count 
              FROM products 
              WHERE 
                "deletedAt" IS NOT NULL
                AND (NOT($1 = ANY("syncedIds")) OR ($1 = ANY("syncedIds") AND "deletedAt" > $2))
            `, [this.appId, lastSyncedAt]);
                        pendingDownloads += parseInt(remoteDeletedResult[0].count, 10);
                    }
                    catch (error) {
                        console.error('Error fetching pending downloads from remote database:', error);
                    }
                }
                return {
                    pendingDownloads,
                    pendingUploads,
                    lastSyncedAt,
                    isSyncing: this.isSyncing,
                    autoSyncEnabled: this.autoSyncEnabled,
                };
            }
            catch (error) {
                console.error('Error fetching product sync status:', error);
                return {
                    pendingUploads: 0,
                    pendingDownloads: 0,
                    lastSyncedAt: null,
                    isSyncing: this.isSyncing,
                    autoSyncEnabled: this.autoSyncEnabled,
                };
            }
        });
    }
    notifySyncStatus(info) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.mainWindow)
                return;
            this.mainWindow.webContents.send(sync_event_1.SYNC_EVENT.PRODUCT_SYNC_STATUS_CHANGED, Object.assign({ isSyncing: this.isSyncing }, info));
        });
    }
    syncProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                return { success: false, uploaded: 0, error: 'Sync already in progress' };
            }
            try {
                this.isSyncing = true;
                this.notifySyncStatus({ status: 'started', direction: 'upload' });
                const remoteDb = remote_database_1.RemoteDatabase.getInstance();
                if (!(yield remoteDb.checkHealth())) {
                    this.notifySyncStatus({
                        status: 'failed',
                        direction: 'upload',
                        error: 'Remote database is not connected',
                    });
                    return {
                        success: false,
                        uploaded: 0,
                        error: 'Remote database is not connected',
                    };
                }
                const localDb = yield database_1.LocalDatabase.getInstance().getDataSource();
                const remoteDataSource = remoteDb.getDataSource();
                let uploadedCount = 0;
                uploadedCount += yield this.uploadModifiedProducts(localDb, remoteDataSource);
                uploadedCount += yield this.uploadDeletedProducts(localDb, remoteDataSource);
                this.notifySyncStatus({
                    status: 'completed',
                    direction: 'upload',
                    uploadedCount,
                });
                return {
                    success: true,
                    uploaded: uploadedCount,
                };
            }
            catch (error) {
                console.error('Error syncing products:', error);
                this.notifySyncStatus({
                    status: 'failed',
                    direction: 'upload',
                    error: error.message,
                });
                return {
                    success: false,
                    uploaded: 0,
                    error: error.message,
                };
            }
            finally {
                this.isSyncing = false;
            }
        });
    }
    /**
     * Pull products from remote database
     * @returns Result of the operation
     */
    pullRemoteProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                return {
                    success: false,
                    downloaded: 0,
                    error: 'Sync already in progress',
                };
            }
            try {
                this.isSyncing = true;
                this.notifySyncStatus({ status: 'started', direction: 'download' });
                const remoteDb = remote_database_1.RemoteDatabase.getInstance();
                if (!(yield remoteDb.checkHealth())) {
                    this.notifySyncStatus({
                        status: 'failed',
                        direction: 'download',
                        error: 'Remote database is not connected',
                    });
                    return {
                        success: false,
                        downloaded: 0,
                        error: 'Remote database is not connected',
                    };
                }
                const localDb = yield database_1.LocalDatabase.getInstance().getDataSource();
                const remoteDataSource = remoteDb.getDataSource();
                // Get last sync time, handle null case properly
                const lastSyncResult = yield localDb
                    .createQueryBuilder()
                    .select('MAX(lastSyncedAt)', 'lastSync')
                    .from('products', 'p')
                    .getRawOne();
                // If lastSyncedAt is null, use a very old date to fetch all products
                // Subtract 1 minute from lastSyncedAt to ensure no products are missed due to timing issues
                const lastSyncedAt = (lastSyncResult === null || lastSyncResult === void 0 ? void 0 : lastSyncResult.lastSync)
                    ? new Date(new Date(lastSyncResult.lastSync).getTime() - 60000) // Subtract 1 minute
                    : new Date(0); // Jan 1, 1970 - will get all products
                console.log(`Using last sync time: ${lastSyncedAt}`);
                // Send initial progress update - starting with 0 items
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('sync-progress-update', {
                        count: 0,
                        total: null,
                    });
                }
                // Track total downloaded items for progress updates
                let totalDownloaded = 0;
                // Process updated products
                const updatedCount = yield this.pullUpdatedProducts(localDb, remoteDataSource, lastSyncedAt, (downloadedBatch) => {
                    // Progress callback for updated products
                    totalDownloaded += downloadedBatch;
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('sync-progress-update', {
                            count: totalDownloaded,
                            total: null,
                        });
                    }
                });
                // Process deleted products
                const deletedCount = yield this.pullDeletedProducts(localDb, remoteDataSource, lastSyncedAt, (downloadedBatch) => {
                    // Progress callback for deleted products
                    totalDownloaded += downloadedBatch;
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('sync-progress-update', {
                            count: totalDownloaded,
                            total: null,
                        });
                    }
                });
                totalDownloaded = updatedCount + deletedCount;
                // Send final progress update
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('sync-progress-update', {
                        count: totalDownloaded,
                        total: totalDownloaded, // Set total equal to count for completion
                    });
                }
                this.notifySyncStatus({
                    status: 'completed',
                    direction: 'download',
                    downloadedCount: totalDownloaded,
                });
                return {
                    success: true,
                    downloaded: totalDownloaded,
                };
            }
            catch (error) {
                console.error('Error pulling remote products:', error);
                this.notifySyncStatus({
                    status: 'failed',
                    direction: 'download',
                    error: error.message,
                });
                return {
                    success: false,
                    downloaded: 0,
                    error: error.message,
                };
            }
            finally {
                this.isSyncing = false;
            }
        });
    }
    performFullSync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                return {
                    success: false,
                    uploaded: 0,
                    downloaded: 0,
                    error: 'Sync already in progress',
                };
            }
            try {
                const pushResult = yield this.syncProducts();
                const pullResult = yield this.pullRemoteProducts();
                return {
                    success: pushResult.success && pullResult.success,
                    uploaded: pushResult.uploaded,
                    downloaded: pullResult.downloaded,
                    error: pushResult.error || pullResult.error,
                };
            }
            catch (error) {
                console.error('Error performing full sync:', error);
                return {
                    success: false,
                    uploaded: 0,
                    downloaded: 0,
                    error: error.message,
                };
            }
        });
    }
    stop() {
        this.stopAutoSync();
    }
    /**
     * Upload modified products to remote database using bulk operations
     * @param localDb Local database connection
     * @param remoteDataSource Remote database connection
     * @returns Number of products uploaded
     */
    uploadModifiedProducts(localDb, remoteDataSource) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Get all locally modified products
            const modifiedProducts = yield localDb
                .createQueryBuilder('products', 'p')
                .select('p')
                .where('p.isModifiedLocally = 1 AND p.deletedAt is NULL')
                .getMany();
            if (!modifiedProducts.length) {
                return 0;
            }
            const now = new Date();
            let uploadedCount = 0;
            try {
                // 2. Separate products into chunks for batch processing
                const chunkSize = 1000; // Adjust based on performance testing
                const chunks = this.chunkArray(modifiedProducts, chunkSize);
                for (const chunk of chunks) {
                    // 3. Get product IDs to check for existence in remote DB
                    const productIds = chunk.map((p) => p.id);
                    // 4. Find existing products in remote DB
                    const existingProducts = yield remoteDataSource
                        .getRepository('products')
                        .createQueryBuilder('p')
                        .select(['p.id', 'p.version'])
                        .where('p.id IN (:...ids)', { ids: productIds })
                        .getMany();
                    // 5. Create maps for quick lookups
                    const existingProductMap = new Map(existingProducts.map((p) => [p.id, parseInt(p.version, 10)]));
                    // 6. Separate products that need to be inserted vs. updated
                    const productsToInsert = [];
                    const productsToUpdate = [];
                    chunk.forEach((product) => {
                        // Add lastSyncedAt to all products
                        const productWithSync = Object.assign(Object.assign({}, product), { lastSyncedAt: now });
                        const remoteVersion = existingProductMap.get(product.id);
                        if (remoteVersion === undefined) {
                            // Product doesn't exist in remote DB - insert
                            productsToInsert.push(productWithSync);
                        }
                        else if (product.version > remoteVersion) {
                            // Product exists but local version is newer - update
                            productsToUpdate.push(productWithSync);
                        }
                        // If remote version is higher or equal, we don't need to do anything
                    });
                    // 7. Perform bulk insert if needed
                    if (productsToInsert.length > 0) {
                        yield this.bulkInsertProducts(remoteDataSource, productsToInsert);
                        uploadedCount += productsToInsert.length;
                        this.notifySyncStatus({
                            status: 'inprogress',
                            direction: 'upload',
                            uploadedCount,
                        });
                    }
                    // 8. Perform bulk update if needed
                    if (productsToUpdate.length > 0) {
                        yield this.bulkUpdateProducts(remoteDataSource, productsToUpdate);
                        uploadedCount += productsToUpdate.length;
                        this.notifySyncStatus({
                            status: 'inprogress',
                            direction: 'upload',
                            uploadedCount,
                        });
                    }
                    // 9. Mark all products in this batch as synced with this app
                    if (productsToInsert.length > 0 || productsToUpdate.length > 0) {
                        const processedIds = [
                            ...productsToInsert.map((p) => p.id),
                            ...productsToUpdate.map((p) => p.id),
                        ];
                        yield this.markProductsAsSynced(remoteDataSource, processedIds);
                    }
                    // 10. Mark all processed products as synced locally in bulk
                    yield localDb
                        .createQueryBuilder()
                        .update('products')
                        .set({ isModifiedLocally: false, lastSyncedAt: now })
                        .where('id IN (:...ids)', { ids: productIds })
                        .execute();
                }
                return uploadedCount;
            }
            catch (error) {
                console.error('Error during bulk upload of modified products:', error);
                throw error;
            }
        });
    }
    /**
     * Mark products as synced with this app by adding the app ID to syncedIds array
     * @param remoteDataSource Remote database connection
     * @param productIds Array of product IDs to mark
     */
    markProductsAsSynced(remoteDataSource, productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (productIds.length === 0)
                return;
            try {
                // Process in batches to avoid parameter limits
                const batchSize = 500;
                const batches = this.chunkArray(productIds, batchSize);
                for (const batch of batches) {
                    // Add this app's ID to the syncedIds array for each product
                    // Use a parameterized query for safety
                    yield remoteDataSource.query(`
          UPDATE products 
          SET "syncedIds" = 
            CASE 
              WHEN "syncedIds" IS NULL THEN ARRAY[$1]
              WHEN NOT($1 = ANY("syncedIds")) THEN array_append("syncedIds", $1)
              ELSE "syncedIds"
            END
          WHERE id IN (${batch.map((_, i) => `$${i + 2}`).join(',')})
        `, [this.appId, ...batch]);
                }
                console.log(`Marked ${productIds.length} products as synced with app ${this.appId}`);
            }
            catch (error) {
                console.error('Error marking products as synced:', error);
                throw error;
            }
        });
    }
    bulkInsertProducts(remoteDataSource, products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (products.length === 0)
                return;
            try {
                // Prepare entities for insertion
                const cleanProducts = products.map((product) => {
                    // Create a clean object without any TypeORM metadata
                    const cleanProduct = Object.assign({}, product);
                    // Initialize syncedIds array with this app's ID
                    cleanProduct.syncedIds = [this.appId];
                    // Ensure dates are properly formatted for PostgreSQL
                    this.formatDatesForPostgres(cleanProduct);
                    return cleanProduct;
                });
                // Execute bulk insert
                yield remoteDataSource.getRepository(product_entity_1.ProductEntity).insert(cleanProducts);
            }
            catch (error) {
                console.error('Error in bulk insert:', error);
                throw error;
            }
        });
    }
    bulkUpdateProducts(remoteDataSource, products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (products.length === 0)
                return;
            try {
                // We'll use transaction for bulk update
                yield remoteDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                    const productRepository = transactionalEntityManager.getRepository(product_entity_1.ProductEntity);
                    // Update each product
                    for (const product of products) {
                        // Create a clean object without TypeORM metadata
                        const cleanProduct = Object.assign({}, product);
                        // Ensure dates are properly formatted for PostgreSQL
                        this.formatDatesForPostgres(cleanProduct);
                        // Remove primary key from the update values
                        const { id } = cleanProduct, updateValues = __rest(cleanProduct, ["id"]);
                        // Execute update with optimistic locking via version check
                        yield productRepository.update({
                            id,
                            version: (0, typeorm_1.LessThan)(product.version),
                        }, updateValues);
                        // Update syncedIds in a separate query to avoid race conditions
                        yield transactionalEntityManager.query(`
            UPDATE products 
            SET "syncedIds" = 
              CASE 
                WHEN "syncedIds" IS NULL THEN ARRAY[$1]
                WHEN NOT($1 = ANY("syncedIds")) THEN array_append("syncedIds", $1)
                ELSE "syncedIds"
              END
            WHERE id = $2
          `, [this.appId, id]);
                    }
                }));
                console.log(`Updated ${products.length} products in remote database`);
            }
            catch (error) {
                console.error('Error in bulk update:', error);
                throw error;
            }
        });
    }
    /**
     * Format date fields for PostgreSQL timestamp without timezone columns
     * @param product Product with dates to format
     */
    formatDatesForPostgres(product) {
        const dateFields = [
            'changeDate',
            'lastSyncedAt',
            'createdAt',
            'updatedAt',
            'deletedAt',
        ];
        for (const field of dateFields) {
            if (product[field] !== null && product[field] !== undefined) {
                try {
                    const dateObj = (0, utils_1.convertExcelDateTypeToDate)(product, field);
                    if (dateObj === null) {
                        continue;
                    }
                    // Format: YYYY-MM-DD HH:MM:SS.mmm (PostgreSQL timestamp without timezone format)
                    product[field] = this.formatDateForPostgres(dateObj);
                }
                catch (error) {
                    console.error(`Error formatting date field ${field}:`, error);
                    product[field] = null;
                }
            }
        }
    }
    /**
     * Helper method to split an array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Upload deleted products to remote database using bulk operations
     * @param localDb Local database connection
     * @param remoteDataSource Remote database connection
     * @returns Number of deleted products synced
     */
    uploadDeletedProducts(localDb, remoteDataSource) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Get all locally deleted products that haven't been synced
            const deletedProducts = yield localDb
                .createQueryBuilder()
                .select('p')
                .from('products', 'p')
                .where('p.deletedAt is NOT NULL')
                .andWhere('p.isModifiedLocally = 1')
                .getMany();
            if (!deletedProducts.length) {
                return 0;
            }
            const now = new Date();
            let uploadedCount = 0;
            try {
                // 2. Process in batches for better performance
                const chunkSize = 100;
                const chunks = this.chunkArray(deletedProducts, chunkSize);
                for (const chunk of chunks) {
                    const productIds = chunk.map((p) => p.id);
                    // 3. Bulk update for soft delete on remote database
                    // Group by deletedAt and version to minimize the number of queries
                    const deletedProductsByDateAndVersion = new Map();
                    chunk.forEach((product) => {
                        // Create a key combining deletedAt and version
                        const key = `${product.deletedAt.getTime()}-${product.version}`;
                        if (!deletedProductsByDateAndVersion.has(key)) {
                            deletedProductsByDateAndVersion.set(key, {
                                ids: [],
                                deletedAt: product.deletedAt,
                                version: product.version,
                            });
                        }
                        deletedProductsByDateAndVersion.get(key).ids.push(product.id);
                    });
                    // 4. Execute bulk updates grouped by deletedAt and version
                    yield remoteDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                        for (const [_, group,] of deletedProductsByDateAndVersion.entries()) {
                            yield transactionalEntityManager
                                .createQueryBuilder()
                                .update('products')
                                .set({
                                deletedAt: group.deletedAt,
                                version: group.version,
                            })
                                .where('id IN (:...ids)', { ids: group.ids })
                                .execute();
                        }
                    }));
                    // 5. Mark all products as synced with this app
                    yield this.markProductsAsSynced(remoteDataSource, productIds);
                    // 6. Mark all these products as synced in the local database
                    yield localDb
                        .createQueryBuilder()
                        .update('products')
                        .set({ isModifiedLocally: false, lastSyncedAt: now })
                        .where('id IN (:...ids)', { ids: productIds })
                        .execute();
                    uploadedCount += chunk.length;
                }
                return uploadedCount;
            }
            catch (error) {
                console.error('Error during bulk upload of deleted products:', error);
                throw error;
            }
        });
    }
    /**
     * Pull updated products from remote database using app ID tracking
     * @param localDb Local database connection
     * @param remoteDataSource Remote database connection
     * @param lastSyncedAt Last sync timestamp
     * @returns Number of products downloaded
     */
    pullUpdatedProducts(localDb, remoteDataSource, lastSyncedAt, progressCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Fetching remote products not synced or updated after ${lastSyncedAt}`);
            let downloadedCount = 0;
            try {
                // Format timestamp for PostgreSQL query
                const formattedLastSyncedAt = this.formatDateForPostgres(lastSyncedAt);
                // Fetch remote products in chunks to avoid memory issues with large datasets
                const batchSize = 1000;
                let offset = 0;
                let hasMoreProducts = true;
                while (hasMoreProducts) {
                    // Query for products that either:
                    // 1. Don't have this app ID in their syncedIds array (never synced to this app)
                    // OR
                    // 2. Have been updated after the last sync time and already synced with this app
                    //    (already synced but updated by someone else)
                    const remoteProducts = yield remoteDataSource.query(`
            SELECT *
            FROM products
            WHERE 
              
              ("syncedIds" IS NULL OR NOT($1 = ANY("syncedIds")) OR ($1 = ANY("syncedIds") AND "updatedAt" > $2))
              AND "deletedAt" IS NULL
            ORDER BY id ASC
            LIMIT $3 OFFSET $4
          `, [this.appId, formattedLastSyncedAt, batchSize, offset]);
                    console.log(`Fetched ${remoteProducts.length} products to sync (batch ${offset / batchSize + 1})`);
                    if (remoteProducts.length === 0) {
                        hasMoreProducts = false;
                        break;
                    }
                    // Get remote product IDs
                    const remoteProductIds = remoteProducts.map((p) => p.id);
                    // Find existing products in local DB
                    const existingLocalProducts = yield localDb
                        .createQueryBuilder()
                        .select(['p.id', 'p.version', 'p.isModifiedLocally'])
                        .from('products', 'p')
                        .where('p.id IN (:...ids)', { ids: remoteProductIds })
                        .getMany();
                    // Create a map for quick lookup
                    const localProductMap = new Map(existingLocalProducts.map((p) => [
                        p.id,
                        {
                            version: parseInt(p.version, 10),
                            isModifiedLocally: Boolean(p.isModifiedLocally),
                        },
                    ]));
                    // Prepare collections for bulk operations
                    const productsToInsert = [];
                    const productsToUpdate = [];
                    // Track products to mark as synced with this app ID
                    const productsToMarkSynced = [];
                    // Current timestamp for lastSyncedAt
                    const now = new Date();
                    // Process each remote product
                    for (const remoteProduct of remoteProducts) {
                        const localProduct = localProductMap.get(remoteProduct.id);
                        // For products that don't have this app ID in syncedIds, add them to productsToMarkSynced
                        if (!remoteProduct.syncedIds ||
                            !Array.isArray(remoteProduct.syncedIds) ||
                            !remoteProduct.syncedIds.includes(this.appId)) {
                            productsToMarkSynced.push(remoteProduct.id);
                        }
                        // Skip products that have been modified locally
                        if (localProduct && localProduct.isModifiedLocally) {
                            console.log(`Skipping ${remoteProduct.id} due to local modifications`);
                            continue;
                        }
                        // Prepare the product with consistent sync data
                        const productToSync = Object.assign(Object.assign({}, remoteProduct), { isModifiedLocally: false, lastSyncedAt: now });
                        // New product - needs to be inserted
                        if (!localProduct) {
                            productsToInsert.push(productToSync);
                        }
                        // Existing product with older version - needs to be updated
                        else if (remoteProduct.version > localProduct.version) {
                            productsToUpdate.push(productToSync);
                        }
                        // Otherwise, remote product isn't newer than local
                    }
                    // Perform bulk insert if needed
                    if (productsToInsert.length > 0) {
                        yield this.bulkInsertProductsLocal(localDb, productsToInsert);
                        downloadedCount += productsToInsert.length;
                        console.log(`Bulk inserted ${productsToInsert.length} new products`);
                        if (progressCallback) {
                            progressCallback(productsToInsert.length);
                        }
                        this.notifySyncStatus({
                            status: 'inprogress',
                            direction: 'download',
                            downloadedCount,
                        });
                    }
                    // Perform bulk update if needed
                    if (productsToUpdate.length > 0) {
                        yield this.bulkUpdateProductsLocal(localDb, productsToUpdate);
                        downloadedCount += productsToUpdate.length;
                        console.log(`Bulk updated ${productsToUpdate.length} existing products`);
                        this.notifySyncStatus({
                            status: 'inprogress',
                            direction: 'download',
                            downloadedCount,
                        });
                    }
                    // Mark all applicable products in this batch as synced with this app
                    if (productsToMarkSynced.length > 0) {
                        yield this.markProductsAsSynced(remoteDataSource, productsToMarkSynced);
                        console.log(`Marked ${productsToMarkSynced.length} products as synced with this app`);
                    }
                    // Move to next batch
                    offset += batchSize;
                }
                console.log(`Total of ${downloadedCount} products downloaded`);
                return downloadedCount;
            }
            catch (error) {
                console.error('Error pulling updated products:', error);
                throw error;
            }
        });
    }
    /**
     * Bulk insert products into local database
     * @param localDb Local database connection
     * @param products Products to insert
     */
    bulkInsertProductsLocal(localDb, products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (products.length === 0)
                return;
            try {
                // Process in chunks to avoid overloading SQLite
                const chunkSize = 1000;
                const chunks = this.chunkArray(products, chunkSize);
                for (const chunk of chunks) {
                    yield localDb.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                        for (const product of chunk) {
                            yield transactionalEntityManager
                                .getRepository('products')
                                .save(product);
                        }
                    }));
                }
            }
            catch (error) {
                console.error('Error during bulk insert to local database:', error);
                throw error;
            }
        });
    }
    /**
     * Bulk update products in local database
     * @param localDb Local database connection
     * @param products Products to update
     */
    bulkUpdateProductsLocal(localDb, products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (products.length === 0)
                return;
            try {
                // Process in chunks to avoid overloading SQLite
                const chunkSize = 1000;
                const chunks = this.chunkArray(products, chunkSize);
                for (const chunk of chunks) {
                    yield localDb.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                        for (const product of chunk) {
                            const { id } = product, updateData = __rest(product, ["id"]);
                            yield transactionalEntityManager
                                .createQueryBuilder()
                                .update('products')
                                .set(updateData)
                                .where('id = :id', { id })
                                .execute();
                        }
                    }));
                }
            }
            catch (error) {
                console.error('Error during bulk update to local database:', error);
                throw error;
            }
        });
    }
    /**
     * Pull deleted products using app ID tracking
     * @param localDb Local database connection
     * @param remoteDataSource Remote database connection
     * @param lastSyncedAt Last sync timestamp
     * @returns Number of products deleted locally
     */
    pullDeletedProducts(localDb, remoteDataSource, lastSyncedAt, progressCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Fetching remote deleted products not synced or deleted after ${lastSyncedAt}`);
            let downloadedCount = 0;
            try {
                // Format timestamp for PostgreSQL query
                const formattedLastSyncedAt = this.formatDateForPostgres(lastSyncedAt);
                // Fetch remote deleted products in chunks
                const batchSize = 1000;
                let offset = 0;
                let hasMoreProducts = true;
                while (hasMoreProducts) {
                    // Fetch products that are deleted AND either:
                    // 1. Not yet synced with this app, OR
                    // 2. Deleted after the last sync time and already synced with this app
                    const remoteDeletedProducts = yield remoteDataSource.query(`
            SELECT *
            FROM products
            WHERE 
              "deletedAt" IS NOT NULL
              AND (NOT($1 = ANY("syncedIds")) OR ($1 = ANY("syncedIds") AND "deletedAt" > $2))
            ORDER BY id ASC
            LIMIT $3 OFFSET $4
          `, [this.appId, formattedLastSyncedAt, batchSize, offset]);
                    console.log(`Fetched ${remoteDeletedProducts.length} deleted products to sync (batch ${offset / batchSize + 1})`);
                    if (remoteDeletedProducts.length === 0) {
                        hasMoreProducts = false;
                        break;
                    }
                    // Get remote product IDs
                    const remoteProductIds = remoteDeletedProducts.map((p) => p.id);
                    // Track products to mark as synced (only the ones not already marked)
                    const productsToMarkSynced = [];
                    // Find locally modified products that shouldn't be deleted
                    const locallyModifiedProducts = yield localDb
                        .createQueryBuilder()
                        .select('p.id')
                        .from('products', 'p')
                        .where('p.id IN (:...ids)', { ids: remoteProductIds })
                        .andWhere('p.isModifiedLocally = 1')
                        .getMany();
                    // Create a set of IDs for quick lookup
                    const locallyModifiedProductIds = new Set(locallyModifiedProducts.map((p) => p.id));
                    // Filter out products that are locally modified
                    const productsToDelete = remoteDeletedProducts.filter((p) => !locallyModifiedProductIds.has(p.id));
                    // Identify products that need to be marked as synced
                    for (const product of remoteDeletedProducts) {
                        if (!product.syncedIds ||
                            !Array.isArray(product.syncedIds) ||
                            !product.syncedIds.includes(this.appId)) {
                            productsToMarkSynced.push(product.id);
                        }
                    }
                    if (productsToDelete.length === 0) {
                        console.log('No products to delete after filtering locally modified products');
                        // Still mark products as synced
                        if (productsToMarkSynced.length > 0) {
                            yield this.markProductsAsSynced(remoteDataSource, productsToMarkSynced);
                            console.log(`Marked ${productsToMarkSynced.length} deleted products as synced with this app`);
                        }
                        offset += batchSize;
                        continue;
                    }
                    // Group deletions by similar deletedAt and version for batching
                    const deletionGroups = new Map();
                    productsToDelete.forEach((product) => {
                        const key = `${product.deletedAt.getTime()}-${product.version}`;
                        if (!deletionGroups.has(key)) {
                            deletionGroups.set(key, {
                                ids: [],
                                deletedAt: product.deletedAt,
                                version: product.version,
                            });
                        }
                        deletionGroups.get(key).ids.push(product.id);
                    });
                    // Perform bulk soft-deletes for each group
                    for (const [_, group] of deletionGroups.entries()) {
                        // Process in smaller chunks if needed
                        const deleteChunkSize = 200;
                        const idChunks = this.chunkArray(group.ids, deleteChunkSize);
                        for (const idChunk of idChunks) {
                            yield localDb
                                .createQueryBuilder()
                                .update('products')
                                .set({
                                deletedAt: group.deletedAt,
                                version: group.version,
                                isModifiedLocally: false,
                                lastSyncedAt: new Date(),
                            })
                                .where('id IN (:...ids)', { ids: idChunk })
                                .andWhere('isModifiedLocally = 0 OR isModifiedLocally IS NULL') // Extra safety check
                                .execute();
                            downloadedCount += idChunk.length;
                            if (progressCallback) {
                                progressCallback(idChunk.length);
                            }
                        }
                    }
                    // Mark products as synced with this app
                    if (productsToMarkSynced.length > 0) {
                        yield this.markProductsAsSynced(remoteDataSource, productsToMarkSynced);
                        console.log(`Marked ${productsToMarkSynced.length} deleted products as synced with this app`);
                    }
                    console.log(`Bulk soft-deleted ${downloadedCount} products in local database`);
                    // Move to next batch
                    offset += batchSize;
                }
                return downloadedCount;
            }
            catch (error) {
                console.error('Error pulling deleted products:', error);
                throw error;
            }
        });
    }
    /**
     * Format a date for PostgreSQL timestamp parameter
     * @param date Date to format
     * @returns Formatted date string
     */
    formatDateForPostgres(date) {
        if (!date)
            return null;
        try {
            const pad = (num, size = 2) => String(num).padStart(size, '0');
            // Use consistent formatting - either all UTC or all local
            // Here we use UTC for consistency with our other PostgreSQL operations
            const year = date.getUTCFullYear();
            const month = pad(date.getUTCMonth() + 1);
            const day = pad(date.getUTCDate());
            const hours = pad(date.getUTCHours());
            const minutes = pad(date.getUTCMinutes());
            const seconds = pad(date.getUTCSeconds());
            const milliseconds = pad(date.getUTCMilliseconds(), 3);
            // Format: YYYY-MM-DD HH:MM:SS.mmm (PostgreSQL timestamp format)
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        }
        catch (error) {
            console.error('Error formatting date for PostgreSQL:', error);
            return date.toISOString(); // Fallback
        }
    }
}
exports.ProductSyncService = ProductSyncService;
exports.default = ProductSyncService.getInstance();
//# sourceMappingURL=product-sync.service.js.map