import { ProductEntity } from '../entities/product.entity';
import {
  PaginationParams,
  PaginationResult,
  ProductRepository,
} from '../repository/product.repository';

export class ProductService {
  private repository: ProductRepository;

  constructor() {
    this.repository = new ProductRepository();
  }

  /**
   * Get all products
   */
  async getAllProducts(): Promise<ProductEntity[]> {
    return this.repository.getAllProducts();
  }

  /**
   * Get products with pagination
   */
  async getProductsPaginated(
    params: PaginationParams
  ): Promise<PaginationResult<ProductEntity>> {
    try {
      return await this.repository.getProductsPaginated(params);
    } catch (error) {
      console.error('Service error getting paginated products:', error);
      throw error;
    }
  }

  /**
   * Get a product by ID
   */
  async getProductById(id: string): Promise<ProductEntity> {
    return this.repository.getProductById(id);
  }

  /**
   * Create a new product
   */
  async createProduct(
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    return this.repository.createProduct(productData);
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    id: string,
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    return this.repository.updateProduct(id, productData);
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<void> {
    return this.repository.deleteProduct(id);
  }

  /**
   * Search for products
   */
  async searchProducts(query: string): Promise<any> {
    return this.repository.searchProducts(query);
  }

  /**
   * Prepare database for bulk operations
   */
  async optimizeDatabaseForBulk(): Promise<void> {
    await this.repository.optimizeDatabaseForBulk();
  }

  /**
   * Restore database settings after bulk operations
   */
  async restoreDatabaseSettings(): Promise<void> {
    await this.repository.restoreDatabaseSettings();
  }

  /**
   * Process a batch of products for insertion
   * @param products Array of products to insert
   * @returns Object with counts of imported and failed products
   */
  async bulkInsertProducts(
    products: Partial<ProductEntity>[]
  ): Promise<{ imported: number; failed: number }> {
    if (!products || products.length === 0) {
      return { imported: 0, failed: 0 };
    }

    return await this.repository.batchInsertProducts(products);
  }

  /**
   * Check if products with the given price list ID already exist
   * @param priceListId The price list ID to check
   * @returns Promise<boolean> True if products exist with this price list ID
   */
  async priceListExists(priceListId: string): Promise<boolean> {
    return await this.repository.priceListExists(priceListId);
  }

  /**
   * Delete all products with a specific price list ID
   * @param priceListId The price list ID to delete
   * @returns Promise<number> Number of products deleted
   */
  async deleteByPriceList(priceListId: string): Promise<number> {
    return await this.repository.deleteByPriceList(priceListId);
  }

  /**
   * Get all unique price list IDs
   * @returns Promise<string[]> Array of unique price list IDs
   */
  async getAllPriceLists(): Promise<string[]> {
    return await this.repository.getAllPriceLists();
  }

  async getAllProgramNames(search?: string): Promise<string[]> {
    return await this.repository.getAllProgramNames(search);
  }

  async getAllCurrencyCodes(search?: string): Promise<string[]> {
    return await this.repository.getAllCurrencyCodes(search);
  }

  async getAllLevels(search?: string): Promise<string[]> {
    return await this.repository.getAllLevels(search);
  }

  async getAllPartNumbers(search?: string): Promise<string[]> {
    return await this.repository.getAllPartNumbers(search);
  }

  async getAllLicenseAgreementTypes(search?: string): Promise<string[]> {
    return await this.repository.getAllLicenseAgreementTypes(search);
  }

  async getAllItemNames(search?: string): Promise<string[]> {
    return await this.repository.getAllItemNames(search);
  }
}
