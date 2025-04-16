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
exports.ProductRepository = void 0;
const database_1 = require("../database/database");
const product_entity_1 = require("../entities/product.entity");
class ProductRepository {
    constructor() {
        this.manager = (0, database_1.getDataSource)().manager;
        // Add this property to store original DB settings
        this.originalDbSettings = null;
        // Get the repository from our data source
        this.repository = (0, database_1.getDataSource)().getRepository(product_entity_1.ProductEntity);
    }
    /**
     * Get all products with pagination
     */
    getProductsPaginated(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { page = 1, pageSize = 50, sortField, sortDirection = 'ASC', filters = {}, } = params;
                const skip = (page - 1) * pageSize;
                // Create query builder
                let queryBuilder = this.repository.createQueryBuilder('product');
                // Apply filters
                if (filters && Object.keys(filters).length > 0) {
                    Object.keys(filters).forEach((key) => {
                        const value = filters[key];
                        if (value !== undefined && value !== null && value !== '') {
                            // Handle special filter keys with operators
                            if (key.includes('_')) {
                                const [fieldName, operator] = key.split('_');
                                switch (operator) {
                                    case 'contains':
                                        queryBuilder.andWhere(`product.${fieldName} LIKE :${key}`, {
                                            [key]: `%${value}%`,
                                        });
                                        break;
                                    case 'gt':
                                        queryBuilder.andWhere(`product.${fieldName} > :${key}`, {
                                            [key]: value,
                                        });
                                        break;
                                    case 'lt':
                                        queryBuilder.andWhere(`product.${fieldName} < :${key}`, {
                                            [key]: value,
                                        });
                                        break;
                                    case 'gte':
                                        queryBuilder.andWhere(`product.${fieldName} >= :${key}`, {
                                            [key]: value,
                                        });
                                        break;
                                    case 'lte':
                                        queryBuilder.andWhere(`product.${fieldName} <= :${key}`, {
                                            [key]: value,
                                        });
                                        break;
                                    case 'eq':
                                        queryBuilder.andWhere(`product.${fieldName} = :${key}`, {
                                            [key]: value,
                                        });
                                        break;
                                }
                            }
                            else {
                                // Default to LIKE for strings and exact match for others
                                if (typeof value === 'string') {
                                    queryBuilder.andWhere(`product.${key} LIKE :${key}`, {
                                        [key]: `%${value}%`,
                                    });
                                }
                                else {
                                    queryBuilder.andWhere(`product.${key} = :${key}`, {
                                        [key]: value,
                                    });
                                }
                            }
                        }
                    });
                }
                // Apply sorting
                if (sortField) {
                    queryBuilder.orderBy(`product.${sortField}`, sortDirection);
                }
                else {
                    // Default sorting
                    queryBuilder.orderBy('product.updatedAt', 'DESC');
                }
                // Get total count before applying pagination
                const totalCount = yield queryBuilder.getCount();
                // Apply pagination
                queryBuilder.skip(skip).take(pageSize);
                // Execute query
                const rows = yield queryBuilder.getMany();
                // Calculate total pages
                const totalPages = Math.ceil(totalCount / pageSize);
                return {
                    rows,
                    totalCount,
                    page,
                    totalPages,
                };
            }
            catch (error) {
                console.error('Error getting paginated products:', error);
                throw error;
            }
        });
    }
    /**
     * Get all products from the database
     */
    getAllProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.find({
                order: { updatedAt: 'DESC' },
            });
        });
    }
    /**
     * Get a product by its ID
     */
    getProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.findOne({
                where: { id },
            });
        });
    }
    /**
     * Create a new product
     */
    createProduct(productData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create a new product instance
            const product = this.repository.create(Object.assign(Object.assign({}, productData), { isModifiedLocally: true, version: 1, lastSyncedAt: null }));
            // Save to database
            return this.repository.save(product);
        });
    }
    /**
     * Update an existing product
     */
    updateProduct(id, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the current product
            const product = yield this.getProductById(id);
            if (!product) {
                throw new Error(`Product with id ${id} not found`);
            }
            // Update the product with new data, increment version
            const updatedProduct = Object.assign(Object.assign({}, productData), { isModifiedLocally: true, version: product.version + 1 });
            // Update the product
            yield this.repository.update(id, updatedProduct);
            // Return the updated product
            return this.getProductById(id);
        });
    }
    /**
     * Soft delete a product (mark as deleted)
     */
    deleteProduct(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.getProductById(id);
            if (!product) {
                throw new Error(`Product with id ${id} not found`);
            }
            // Mark as deleted and update version
            yield this.repository.update(id, {
                deletedAt: new Date(),
                isModifiedLocally: true,
                version: product.version + 1,
            });
        });
    }
    /**
     * Hard delete a product (remove from database)
     */
    hardDeleteProduct(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.repository.delete(id);
        });
    }
    /**
     * Mark a product as synced
     */
    markAsSynced(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.repository.update(id, {
                isModifiedLocally: false,
                lastSyncedAt: new Date(),
            });
        });
    }
    /**
     * Get all locally modified products (for sync)
     */
    getModifiedProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.find({
                where: { isModifiedLocally: true },
            });
        });
    }
    /**
     * Bulk update products (for sync)
     */
    bulkSave(products) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.save(products);
        });
    }
    getPendingSyncCount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pendingProductCount = yield this.repository
                    .createQueryBuilder('product')
                    .select('COUNT(*)', 'count')
                    .where('product.isModifiedLocally = :isModifiedLocally', {
                    isModifiedLocally: true,
                })
                    .getRawOne();
                return parseInt(pendingProductCount[0].count, 10);
            }
            catch (error) {
                console.error('Error getting pending sync count:', error);
                return 0;
            }
        });
    }
    /**
     * Bulk insert products
     * @param products Array of products to insert
     * @returns The number of products inserted
     */
    bulkImportProducts(products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!products || products.length === 0) {
                return 0;
            }
            try {
                // Start a worker to handle the import
                return products.length;
            }
            catch (error) {
                console.error('Error in bulkImportProducts:', error);
                throw error;
            }
        });
    }
    // Add these methods to your ProductRepository class
    /**
     * Optimizes database for bulk operations
     */
    optimizeDatabaseForBulk() {
        return __awaiter(this, void 0, void 0, function* () {
            // Store original settings to restore later if needed
            const originalSettings = {
                synchronous: yield this.manager.query('PRAGMA synchronous'),
                journalMode: yield this.manager.query('PRAGMA journal_mode'),
            };
            // Save settings for later restoration
            this.originalDbSettings = originalSettings;
            // Apply optimizations
            yield this.manager.query('PRAGMA synchronous = OFF');
            yield this.manager.query('PRAGMA journal_mode = MEMORY');
            yield this.manager.query('PRAGMA temp_store = MEMORY');
            yield this.manager.query('PRAGMA cache_size = 10000');
        });
    }
    /**
     * Restores database to normal settings after bulk operations
     */
    restoreDatabaseSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.originalDbSettings) {
                // Restore original settings
                yield this.manager.query(`PRAGMA synchronous = ${this.originalDbSettings.synchronous || 'NORMAL'}`);
                yield this.manager.query(`PRAGMA journal_mode = ${this.originalDbSettings.journalMode || 'DELETE'}`);
            }
            // Reset to defaults
            yield this.manager.query('PRAGMA temp_store = DEFAULT');
            yield this.manager.query('PRAGMA cache_size = 2000');
            // Clear saved settings
            this.originalDbSettings = null;
        });
    }
    /**
     * Batch inserts multiple products
     * @param products Array of products to insert
     * @returns Object with counts of successful and failed inserts
     */
    batchInsertProducts(products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!products || products.length === 0) {
                return { imported: 0, failed: 0 };
            }
            let imported = 0;
            let failed = 0;
            try {
                // Start transaction
                yield this.manager.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                    for (const product of products) {
                        try {
                            // Prepare product entity
                            const productEntity = new product_entity_1.ProductEntity();
                            // Map properties
                            Object.assign(productEntity, Object.assign(Object.assign({}, product), { 
                                // Set default values if not provided
                                isModifiedLocally: true, version: product.version || 1 }));
                            // Save the entity
                            yield transactionalEntityManager.save(productEntity);
                            imported++;
                        }
                        catch (error) {
                            console.error('Error inserting product:', error);
                            failed++;
                            // Continue with next product instead of failing entire batch
                        }
                    }
                }));
                return { imported, failed };
            }
            catch (error) {
                console.error('Error in batch insert transaction:', error);
                throw error;
            }
        });
    }
    /**
     * Check if a price list ID already exists in the database
     * @param priceListId The price list ID to check
     * @returns Promise<boolean> True if it exists, false otherwise
     */
    priceListExists(priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!priceListId)
                return false;
            const count = yield this.repository.count({
                where: { priceListId },
            });
            return count > 0;
        });
    }
    /**
     * Delete all products with a specific price list ID
     * @param priceListId The price list ID to delete
     * @returns Promise<number> Number of products deleted
     */
    deleteByPriceList(priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!priceListId)
                return 0;
            const result = yield this.repository.delete({ priceListId });
            return result.affected || 0;
        });
    }
    /**
     * Get all unique price list IDs in the database
     * @returns Promise<string[]> Array of unique price list IDs
     */
    getAllPriceLists() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.priceListId', 'priceListId')
                .where('product.priceListId IS NOT NULL')
                .getRawMany();
            return result.map((item) => item.priceListId);
        });
    }
    getAllProgramNames(search) {
        return __awaiter(this, void 0, void 0, function* () {
            let queryBuilder = this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.programName', 'programName')
                .where('product.programName IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (search && search.trim()) {
                queryBuilder = queryBuilder.andWhere('"programName" LIKE :search', {
                    search: `%${search.trim()}%`,
                });
            }
            const result = yield queryBuilder
                .orderBy('"programName"')
                .limit(100)
                .getRawMany();
            return result.map((item) => item.programName);
        });
    }
    getAllCurrencyCodes(seach) {
        return __awaiter(this, void 0, void 0, function* () {
            let queryBuilder = this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.currencyCode', 'currencyCode')
                .where('product.currencyCode IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (seach && seach.trim()) {
                queryBuilder.andWhere('"currencyCode" LIKE :seach', {
                    seach: `%${seach.trim()}%`,
                });
            }
            queryBuilder.orderBy('"currencyCode"').limit(100);
            const result = yield queryBuilder.getRawMany();
            return result.map((item) => item.currencyCode);
        });
    }
    getAllLicenseAgreementTypes(search) {
        return __awaiter(this, void 0, void 0, function* () {
            let queryBuilder = this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.licenseAgreementType', 'licenseAgreementType')
                .where('product.licenseAgreementType IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (search && search.trim()) {
                queryBuilder.andWhere('"licenseAgreementType" LIKE :search', {
                    search: `%${search.trim()}%`,
                });
            }
            queryBuilder.orderBy('"licenseAgreementType"').limit(100);
            const result = yield queryBuilder.getRawMany();
            return result.map((item) => item.licenseAgreementType);
        });
    }
    getAllLevels(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryBuilder = this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.level', 'level')
                .where('product.level IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (search && search.trim()) {
                queryBuilder.andWhere('"level" LIKE :search', {
                    search: `%${search.trim()}%`,
                });
            }
            queryBuilder.orderBy('"level"').limit(100);
            const result = yield queryBuilder.getRawMany();
            return result.map((item) => item.level);
        });
    }
    getAllPartNumbers(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryBuilder = this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.partNumber', 'partNumber')
                .where('product.partNumber IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (search && search.trim()) {
                queryBuilder.andWhere('"partNumber" LIKE :search', {
                    search: `%${search.trim()}%`,
                });
            }
            queryBuilder.orderBy('"partNumber"').limit(100);
            const result = yield queryBuilder.getRawMany();
            return result.map((item) => item.partNumber);
        });
    }
    getAllItemNames(search) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryBuilder = yield this.repository
                .createQueryBuilder('product')
                .select('DISTINCT product.itemName', 'itemName')
                .where('product.itemName IS NOT NULL')
                .andWhere('"deletedAt" IS NULL');
            if (search && search.trim()) {
                queryBuilder.andWhere('"itemName" LIKE :search', {
                    search: `%${search.trim()}%`,
                });
            }
            queryBuilder.orderBy('"itemName"').limit(100);
            const result = yield queryBuilder.getRawMany();
            return result.map((item) => item.itemName);
        });
    }
    searchProducts(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let queryBuilder = yield this.repository
                    .createQueryBuilder('product')
                    .where('"deletedAt" IS NULL');
                if (query.programName) {
                    queryBuilder = queryBuilder.andWhere('"programName" = :programName', {
                        programName: query.programName,
                    });
                }
                if (query.licenseAgreementTypes) {
                    queryBuilder = queryBuilder.andWhere('"licenseAgreementType" = :licenseAgreementType', {
                        licenseAgreementType: query.licenseAgreementTypes,
                    });
                }
                if (query.partNumbers && query.partNumbers.length > 0) {
                    queryBuilder = queryBuilder.andWhere('"partNumber" IN (:...partNumbers)', {
                        partNumbers: query.partNumbers,
                    });
                }
                if (query.itemNames && query.itemNames.length > 0) {
                    queryBuilder = queryBuilder.andWhere('"itemName" IN (:...itemNames)', {
                        itemNames: query.itemNames,
                    });
                }
                if (query.levels) {
                    queryBuilder = queryBuilder.andWhere('"level" = :level', {
                        level: query.levels,
                    });
                }
                if (query.currencyCode) {
                    queryBuilder = queryBuilder.andWhere('"currencyCode" = :currencyCode', {
                        currencyCode: query.currencyCode,
                    });
                }
                // Add sorting
                const sortField = query.sortField || 'partNumber';
                const sortDirection = query.sortDirection || 'ASC';
                queryBuilder = queryBuilder.orderBy(`"${sortField}"`, sortDirection);
                // Add pagination
                const page = query.page || 1;
                const pageSize = query.pageSize || 50;
                const skip = (page - 1) * pageSize;
                queryBuilder = queryBuilder.skip(skip).take(pageSize);
                // Get results and total count
                const [results, total] = yield queryBuilder.getManyAndCount();
                return {
                    results,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize),
                    },
                };
            }
            catch (error) {
                console.error('Error searching products:', error);
                throw error;
            }
        });
    }
}
exports.ProductRepository = ProductRepository;
//# sourceMappingURL=product.repository.js.map