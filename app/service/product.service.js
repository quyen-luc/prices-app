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
exports.ProductService = void 0;
const product_repository_1 = require("../repository/product.repository");
class ProductService {
    constructor() {
        this.repository = new product_repository_1.ProductRepository();
    }
    /**
     * Get all products
     */
    getAllProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.getAllProducts();
        });
    }
    /**
     * Get products with pagination
     */
    getProductsPaginated(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.repository.getProductsPaginated(params);
            }
            catch (error) {
                console.error('Service error getting paginated products:', error);
                throw error;
            }
        });
    }
    /**
     * Get a product by ID
     */
    getProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.getProductById(id);
        });
    }
    /**
     * Create a new product
     */
    createProduct(productData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.createProduct(productData);
        });
    }
    /**
     * Update an existing product
     */
    updateProduct(id, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.updateProduct(id, productData);
        });
    }
    /**
     * Delete a product
     */
    deleteProduct(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.deleteProduct(id);
        });
    }
    /**
     * Search for products
     */
    searchProducts(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.searchProducts(query);
        });
    }
    /**
     * Prepare database for bulk operations
     */
    optimizeDatabaseForBulk() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.repository.optimizeDatabaseForBulk();
        });
    }
    /**
     * Restore database settings after bulk operations
     */
    restoreDatabaseSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.repository.restoreDatabaseSettings();
        });
    }
    /**
     * Process a batch of products for insertion
     * @param products Array of products to insert
     * @returns Object with counts of imported and failed products
     */
    bulkInsertProducts(products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!products || products.length === 0) {
                return { imported: 0, failed: 0 };
            }
            return yield this.repository.batchInsertProducts(products);
        });
    }
    /**
     * Check if products with the given price list ID already exist
     * @param priceListId The price list ID to check
     * @returns Promise<boolean> True if products exist with this price list ID
     */
    priceListExists(priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.priceListExists(priceListId);
        });
    }
    /**
     * Delete all products with a specific price list ID
     * @param priceListId The price list ID to delete
     * @returns Promise<number> Number of products deleted
     */
    deleteByPriceList(priceListId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.deleteByPriceList(priceListId);
        });
    }
    /**
     * Get all unique price list IDs
     * @returns Promise<string[]> Array of unique price list IDs
     */
    getAllPriceLists() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllPriceLists();
        });
    }
    getAllProgramNames(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllProgramNames(search);
        });
    }
    getAllCurrencyCodes(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllCurrencyCodes(search);
        });
    }
    getAllLevels(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllLevels(search);
        });
    }
    getAllPartNumbers(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllPartNumbers(search);
        });
    }
    getAllLicenseAgreementTypes(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllLicenseAgreementTypes(search);
        });
    }
    getAllItemNames(search) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getAllItemNames(search);
        });
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map