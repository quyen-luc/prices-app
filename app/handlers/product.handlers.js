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
exports.unregisterIpcHandlers = exports.registerIpcHandlers = exports.ProductHandlers = void 0;
const electron_1 = require("electron");
const product_service_1 = require("../service/product.service");
const fs = require("fs");
const XLSX = require("xlsx");
/**
 * Handler class for product-related IPC communications
 */
class ProductHandlers {
    constructor() {
        this.initialized = false;
        this.productService = new product_service_1.ProductService();
    }
    /**
     * Get the singleton instance of ProductHandlers
     */
    static getInstance() {
        if (!ProductHandlers.instance) {
            ProductHandlers.instance = new ProductHandlers();
        }
        return ProductHandlers.instance;
    }
    /**
     * Register all IPC handlers
     */
    registerHandlers() {
        if (!this.initialized) {
            console.warn('Registering handlers before initialization. Call initialize() first.');
        }
        // Product handlers
        electron_1.ipcMain.handle('get-all-products', this.handleGetAllProducts.bind(this));
        electron_1.ipcMain.handle('get-products-paginated', this.handleGetProductsPaginated.bind(this));
        electron_1.ipcMain.handle('get-product', this.handleGetProduct.bind(this));
        electron_1.ipcMain.handle('create-product', this.handleCreateProduct.bind(this));
        electron_1.ipcMain.handle('update-product', this.handleUpdateProduct.bind(this));
        electron_1.ipcMain.handle('delete-product', this.handleDeleteProduct.bind(this));
        electron_1.ipcMain.handle('search-products', this.handleSearchProducts.bind(this));
        // File dialog and Excel handlers
        electron_1.ipcMain.handle('open-file-dialog', this.handleOpenFileDialog.bind(this));
        electron_1.ipcMain.handle('read-excel-file', this.handleReadExcelFile.bind(this));
        electron_1.ipcMain.handle('optimize-database-for-bulk', this.handleOptimizeDatabaseForBulk.bind(this));
        electron_1.ipcMain.handle('restore-database-settings', this.handleRestoreDatabaseSettings.bind(this));
        electron_1.ipcMain.handle('batch-insert-products', this.handleBatchInsertProducts.bind(this));
        electron_1.ipcMain.handle('save-file-dialog', this.handleSaveFileDialog.bind(this));
        electron_1.ipcMain.handle('write-excel-file', this.handleWriteExcelFile.bind(this));
        electron_1.ipcMain.handle('check-price-list-exists', this.handleCheckPriceListExists.bind(this));
        electron_1.ipcMain.handle('delete-products-by-price-list', this.handleDeleteProductsByPriceList.bind(this));
        electron_1.ipcMain.handle('get-all-price-lists', this.handleGetAllPriceLists.bind(this));
        electron_1.ipcMain.handle('get-distinct-program-names', this.handleGetDistinctProgramNames.bind(this));
        electron_1.ipcMain.handle('get-distinct-currency-codes', this.handleGetDistinctCurrencyCodes.bind(this));
        electron_1.ipcMain.handle('get-distinct-levels', this.handleGetDistinctLevels.bind(this));
        electron_1.ipcMain.handle('get-distinct-part-numbers', this.handleGetDistinctPartNumbers.bind(this));
        electron_1.ipcMain.handle('get-distinct-license-agreement-types', this.handleGetDistinctLicenseAgreementTypes.bind(this));
        electron_1.ipcMain.handle('get-distinct-item-names', this.handleGetDistinctItemNames.bind(this));
        console.log('IPC handlers registered');
    }
    /**
     * Unregister all IPC handlers (useful for cleanup)
     */
    unregisterHandlers() {
        electron_1.ipcMain.removeHandler('get-all-products');
        electron_1.ipcMain.removeHandler('get-products-paginated');
        electron_1.ipcMain.removeHandler('get-product');
        electron_1.ipcMain.removeHandler('create-product');
        electron_1.ipcMain.removeHandler('update-product');
        electron_1.ipcMain.removeHandler('delete-product');
        electron_1.ipcMain.removeHandler('search-products');
        electron_1.ipcMain.removeHandler('open-file-dialog');
        electron_1.ipcMain.removeHandler('read-excel-file');
        electron_1.ipcMain.removeHandler('save-file-dialog');
        electron_1.ipcMain.removeHandler('write-excel-file');
        electron_1.ipcMain.removeHandler('optimize-database-for-bulk');
        electron_1.ipcMain.removeHandler('restore-database-settings');
        electron_1.ipcMain.removeHandler('batch-insert-products');
        electron_1.ipcMain.removeHandler('check-price-list-exists');
        electron_1.ipcMain.removeHandler('delete-products-by-price-list');
        electron_1.ipcMain.removeHandler('get-all-price-lists');
        electron_1.ipcMain.removeHandler('get-distinct-program-names');
        electron_1.ipcMain.removeHandler('get-distinct-currency-codes');
        electron_1.ipcMain.removeHandler('get-distinct-levels');
        electron_1.ipcMain.removeHandler('get-distinct-part-numbers');
        electron_1.ipcMain.removeHandler('get-distinct-license-agreement-types');
        electron_1.ipcMain.removeHandler('get-distinct-item-names');
        console.log('IPC handlers unregistered');
    }
    handleGetAllPriceLists(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.getAllPriceLists();
            }
            catch (error) {
                console.error('Error getting all price lists:', error);
                throw error;
            }
        });
    }
    handleCheckPriceListExists(event, priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.priceListExists(priceListId);
            }
            catch (error) {
                console.error('Error checking price list existence:', error);
                throw error;
            }
        });
    }
    handleDeleteProductsByPriceList(event, priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.deleteByPriceList(priceListId);
            }
            catch (error) {
                console.error('Error deleting products by price list:', error);
                throw error;
            }
        });
    }
    // NEW: Handler for paginated products
    handleGetProductsPaginated(event, params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.getProductsPaginated(params);
            }
            catch (error) {
                console.error('Error in handler getting paginated products:', error);
                throw error;
            }
        });
    }
    /**
     * Get all products
     */
    handleGetAllProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.getAllProducts();
            }
            catch (error) {
                console.error('Error getting products:', error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Get a product by ID
     */
    handleGetProduct(event, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.getProductById(id);
            }
            catch (error) {
                console.error(`Error getting product ${id}:`, error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Create a new product
     */
    handleCreateProduct(event, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.createProduct(productData);
            }
            catch (error) {
                console.error('Error creating product:', error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Update an existing product
     */
    handleUpdateProduct(event, id, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.updateProduct(id, productData);
            }
            catch (error) {
                console.error(`Error updating product ${id}:`, error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Delete a product
     */
    handleDeleteProduct(event, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productService.deleteProduct(id);
                return { success: true };
            }
            catch (error) {
                console.error(`Error deleting product ${id}:`, error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Search for products
     */
    handleSearchProducts(event, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.productService.searchProducts(query);
            }
            catch (error) {
                console.error(`Error searching products:`, error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Format error for IPC transmission
     */
    formatError(error) {
        // Create a serializable error object
        return {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        };
    }
    /**
     * Handle file dialog open
     */
    handleOpenFileDialog(event, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield electron_1.dialog.showOpenDialog(options);
            }
            catch (error) {
                console.error('Error in open-file-dialog handler:', error);
                throw this.formatError(error);
            }
        });
    }
    /**
     * Handle Excel file reading
     */
    handleReadExcelFile(event, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Reading Excel file: ${filePath}`);
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    throw new Error(`File does not exist: ${filePath}`);
                }
                // Read file permissions
                try {
                    fs.accessSync(filePath, fs.constants.R_OK);
                }
                catch (error) {
                    throw new Error(`No read permission for file: ${filePath}`);
                }
                // Read the file
                const workbook = XLSX.readFile(filePath);
                // Get the first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // Convert to JSON
                const data = XLSX.utils.sheet_to_json(worksheet);
                return {
                    success: true,
                    data,
                    sheetNames: workbook.SheetNames,
                };
            }
            catch (error) {
                console.error('Error reading Excel file:', error);
                return {
                    success: false,
                    error: error.message,
                };
            }
        });
    }
    handleSaveFileDialog(event, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield electron_1.dialog.showSaveDialog(options);
            }
            catch (error) {
                console.error('Error in save file dialog:', error);
                return { canceled: true, error: error.message };
            }
        });
    }
    handleWriteExcelFile(event, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { filePath, data } = params;
            try {
                // Create a new workbook
                const workbook = XLSX.utils.book_new();
                // Convert data to worksheet
                const worksheet = XLSX.utils.json_to_sheet(data);
                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
                // Set column widths (optional)
                const columnWidths = [];
                if (data.length > 0) {
                    const headers = Object.keys(data[0]);
                    headers.forEach(() => columnWidths.push({ wch: 15 })); // Default width 15
                    worksheet['!cols'] = columnWidths;
                }
                // Write to file
                XLSX.writeFile(workbook, filePath);
                return { success: true, filePath };
            }
            catch (error) {
                console.error('Error writing Excel file:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Handle database optimization for bulk operations
     */
    handleOptimizeDatabaseForBulk() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productService.optimizeDatabaseForBulk();
                return { success: true };
            }
            catch (error) {
                console.error('Error optimizing database:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Handle database settings restoration
     */
    handleRestoreDatabaseSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productService.restoreDatabaseSettings();
                return { success: true };
            }
            catch (error) {
                console.error('Error restoring database settings:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Handle batch product insertion
     */
    handleBatchInsertProducts(event, products) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.bulkInsertProducts(products);
                return result;
            }
            catch (error) {
                console.error('Error in batch insertion:', error);
                throw this.formatError(error);
            }
        });
    }
    handleGetDistinctProgramNames(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.getAllProgramNames(search);
                return result
                    .map((item) => item)
                    .filter((name) => name !== null && name !== '');
            }
            catch (error) {
                console.error('Error getting distinct program names:', error);
                return [];
            }
        });
    }
    handleGetDistinctCurrencyCodes(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.getAllCurrencyCodes(search);
                return result
                    .map((item) => item)
                    .filter((code) => code !== null && code !== '');
            }
            catch (error) {
                console.error('Error getting distinct currency codes:', error);
                return [];
            }
        });
    }
    handleGetDistinctLevels(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.getAllLevels(search);
                return result
                    .map((item) => item)
                    .filter((level) => level !== null && level !== '');
            }
            catch (error) {
                console.error('Error getting distinct levels:', error);
                return [];
            }
        });
    }
    handleGetDistinctPartNumbers(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Getting distinct part numbers with search:', search);
                const result = yield this.productService.getAllPartNumbers(search);
                return result
                    .map((item) => item)
                    .filter((partNumber) => partNumber !== null && partNumber !== '');
            }
            catch (error) {
                console.error('Error getting distinct part numbers:', error);
                return [];
            }
        });
    }
    handleGetDistinctLicenseAgreementTypes(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.getAllLicenseAgreementTypes(search);
                return result
                    .map((item) => item)
                    .filter((type) => type !== null && type !== '');
            }
            catch (error) {
                console.error('Error getting distinct license agreement types:', error);
                return [];
            }
        });
    }
    handleGetDistinctItemNames(event, search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.productService.getAllItemNames(search);
                return result
                    .map((item) => item)
                    .filter((name) => name !== null && name !== '');
            }
            catch (error) {
                console.error('Error getting distinct item names:', error);
                return [];
            }
        });
    }
}
exports.ProductHandlers = ProductHandlers;
function registerIpcHandlers() {
    ProductHandlers.getInstance().registerHandlers();
}
exports.registerIpcHandlers = registerIpcHandlers;
function unregisterIpcHandlers() {
    ProductHandlers.getInstance().unregisterHandlers();
}
exports.unregisterIpcHandlers = unregisterIpcHandlers;
//# sourceMappingURL=product.handlers.js.map