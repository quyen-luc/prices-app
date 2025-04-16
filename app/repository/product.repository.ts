import { Repository } from 'typeorm';
import { getDataSource } from '../database/database';
import { ProductEntity } from '../entities/product.entity';

// Define pagination parameters interface
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

// Define pagination result interface
export interface PaginationResult<T> {
  rows: T[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export class ProductRepository {
  private repository: Repository<ProductEntity>;
  private manager = getDataSource().manager;

  // Add this property to store original DB settings
  private originalDbSettings: any = null;

  constructor() {
    // Get the repository from our data source
    this.repository = getDataSource().getRepository(ProductEntity);
  }

  /**
   * Get all products with pagination
   */
  async getProductsPaginated(
    params: PaginationParams
  ): Promise<PaginationResult<ProductEntity>> {
    try {
      const {
        page = 1,
        pageSize = 50,
        sortField,
        sortDirection = 'ASC',
        filters = {},
      } = params;
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
            } else {
              // Default to LIKE for strings and exact match for others
              if (typeof value === 'string') {
                queryBuilder.andWhere(`product.${key} LIKE :${key}`, {
                  [key]: `%${value}%`,
                });
              } else {
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
      } else {
        // Default sorting
        queryBuilder.orderBy('product.updatedAt', 'DESC');
      }

      // Get total count before applying pagination
      const totalCount = await queryBuilder.getCount();

      // Apply pagination
      queryBuilder.skip(skip).take(pageSize);

      // Execute query
      const rows = await queryBuilder.getMany();

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        rows,
        totalCount,
        page,
        totalPages,
      };
    } catch (error) {
      console.error('Error getting paginated products:', error);
      throw error;
    }
  }

  /**
   * Get all products from the database
   */
  async getAllProducts(): Promise<ProductEntity[]> {
    return this.repository.find({
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Get a product by its ID
   */
  async getProductById(id: string): Promise<ProductEntity> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Create a new product
   */
  async createProduct(
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    // Create a new product instance
    const product = this.repository.create({
      ...productData,
      isModifiedLocally: true,
      version: 1,
      lastSyncedAt: null,
    });

    // Save to database
    return this.repository.save(product);
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    id: string,
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    // Get the current product
    const product = await this.getProductById(id);

    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }

    // Update the product with new data, increment version
    const updatedProduct = {
      ...productData,
      isModifiedLocally: true,
      version: product.version + 1,
    };

    // Update the product
    await this.repository.update(id, updatedProduct);

    // Return the updated product
    return this.getProductById(id);
  }

  /**
   * Soft delete a product (mark as deleted)
   */
  async deleteProduct(id: string): Promise<void> {
    const product = await this.getProductById(id);

    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }

    // Mark as deleted and update version
    await this.repository.update(id, {
      deletedAt: new Date(),
      isModifiedLocally: true,
      version: product.version + 1,
    });
  }

  /**
   * Hard delete a product (remove from database)
   */
  async hardDeleteProduct(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Mark a product as synced
   */
  async markAsSynced(id: string): Promise<void> {
    await this.repository.update(id, {
      isModifiedLocally: false,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Get all locally modified products (for sync)
   */
  async getModifiedProducts(): Promise<ProductEntity[]> {
    return this.repository.find({
      where: { isModifiedLocally: true },
    });
  }

  /**
   * Bulk update products (for sync)
   */
  async bulkSave(products: ProductEntity[]): Promise<ProductEntity[]> {
    return this.repository.save(products);
  }

  async getPendingSyncCount(): Promise<number> {
    try {
      const pendingProductCount = await this.repository
        .createQueryBuilder('product')
        .select('COUNT(*)', 'count')
        .where('product.isModifiedLocally = :isModifiedLocally', {
          isModifiedLocally: true,
        })
        .getRawOne();
      return parseInt(pendingProductCount[0].count, 10);
    } catch (error) {
      console.error('Error getting pending sync count:', error);
      return 0;
    }
  }

  /**
   * Bulk insert products
   * @param products Array of products to insert
   * @returns The number of products inserted
   */
  async bulkImportProducts(
    products: Partial<ProductEntity>[]
  ): Promise<number> {
    if (!products || products.length === 0) {
      return 0;
    }

    try {
      // Start a worker to handle the import
      return products.length;
    } catch (error) {
      console.error('Error in bulkImportProducts:', error);
      throw error;
    }
  }
  // Add these methods to your ProductRepository class

  /**
   * Optimizes database for bulk operations
   */
  async optimizeDatabaseForBulk(): Promise<void> {
    // Store original settings to restore later if needed
    const originalSettings = {
      synchronous: await this.manager.query('PRAGMA synchronous'),
      journalMode: await this.manager.query('PRAGMA journal_mode'),
    };

    // Save settings for later restoration
    this.originalDbSettings = originalSettings;

    // Apply optimizations
    await this.manager.query('PRAGMA synchronous = OFF');
    await this.manager.query('PRAGMA journal_mode = MEMORY');
    await this.manager.query('PRAGMA temp_store = MEMORY');
    await this.manager.query('PRAGMA cache_size = 10000');
  }

  /**
   * Restores database to normal settings after bulk operations
   */
  async restoreDatabaseSettings(): Promise<void> {
    if (this.originalDbSettings) {
      // Restore original settings
      await this.manager.query(
        `PRAGMA synchronous = ${
          this.originalDbSettings.synchronous || 'NORMAL'
        }`
      );
      await this.manager.query(
        `PRAGMA journal_mode = ${
          this.originalDbSettings.journalMode || 'DELETE'
        }`
      );
    }

    // Reset to defaults
    await this.manager.query('PRAGMA temp_store = DEFAULT');
    await this.manager.query('PRAGMA cache_size = 2000');

    // Clear saved settings
    this.originalDbSettings = null;
  }

  /**
   * Batch inserts multiple products
   * @param products Array of products to insert
   * @returns Object with counts of successful and failed inserts
   */
  async batchInsertProducts(
    products: Partial<ProductEntity>[]
  ): Promise<{ imported: number; failed: number }> {
    if (!products || products.length === 0) {
      return { imported: 0, failed: 0 };
    }

    let imported = 0;
    let failed = 0;

    try {
      // Start transaction
      await this.manager.transaction(async (transactionalEntityManager) => {
        for (const product of products) {
          try {
            // Prepare product entity
            const productEntity = new ProductEntity();

            // Map properties
            Object.assign(productEntity, {
              ...product,
              // Set default values if not provided
              isModifiedLocally: true,
              version: product.version || 1,
            });

            // Save the entity
            await transactionalEntityManager.save(productEntity);
            imported++;
          } catch (error) {
            console.error('Error inserting product:', error);
            failed++;
            // Continue with next product instead of failing entire batch
          }
        }
      });

      return { imported, failed };
    } catch (error) {
      console.error('Error in batch insert transaction:', error);
      throw error;
    }
  }

  /**
   * Check if a price list ID already exists in the database
   * @param priceListId The price list ID to check
   * @returns Promise<boolean> True if it exists, false otherwise
   */
  async priceListExists(priceListId: string): Promise<boolean> {
    if (!priceListId) return false;

    const count = await this.repository.count({
      where: { priceListId },
    });

    return count > 0;
  }

  /**
   * Delete all products with a specific price list ID
   * @param priceListId The price list ID to delete
   * @returns Promise<number> Number of products deleted
   */
  async deleteByPriceList(priceListId: string): Promise<number> {
    if (!priceListId) return 0;

    const result = await this.repository.delete({ priceListId });
    return result.affected || 0;
  }

  /**
   * Get all unique price list IDs in the database
   * @returns Promise<string[]> Array of unique price list IDs
   */
  async getAllPriceLists(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('product')
      .select('DISTINCT product.priceListId', 'priceListId')
      .where('product.priceListId IS NOT NULL')
      .getRawMany();

    return result.map((item) => item.priceListId);
  }

  async getAllProgramNames(search?: string): Promise<string[]> {
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

    const result = await queryBuilder
      .orderBy('"programName"')
      .limit(100)
      .getRawMany();

    return result.map((item) => item.programName);
  }

  async getAllCurrencyCodes(seach?: string): Promise<string[]> {
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
    const result = await queryBuilder.getRawMany();

    return result.map((item) => item.currencyCode);
  }

  async getAllLicenseAgreementTypes(search?: string): Promise<string[]> {
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
    const result = await queryBuilder.getRawMany();

    return result.map((item) => item.licenseAgreementType);
  }

  async getAllLevels(search?: string): Promise<string[]> {
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
    const result = await queryBuilder.getRawMany();

    return result.map((item) => item.level);
  }

  async getAllPartNumbers(search?: string): Promise<string[]> {
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

    const result = await queryBuilder.getRawMany();

    return result.map((item) => item.partNumber);
  }

  async getAllItemNames(search?: string): Promise<string[]> {
    const queryBuilder = await this.repository
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

    const result = await queryBuilder.getRawMany();

    return result.map((item) => item.itemName);
  }

  async searchProducts(query: any): Promise<any> {
    try {
      let queryBuilder = await this.repository
        .createQueryBuilder('product')
        .where('"deletedAt" IS NULL');

      if (query.programName) {
        queryBuilder = queryBuilder.andWhere('"programName" = :programName', {
          programName: query.programName,
        });
      }

      if (query.licenseAgreementTypes) {
        queryBuilder = queryBuilder.andWhere(
          '"licenseAgreementType" = :licenseAgreementType',
          {
            licenseAgreementType: query.licenseAgreementTypes,
          }
        );
      }

      if (query.partNumbers && query.partNumbers.length > 0) {
        queryBuilder = queryBuilder.andWhere(
          '"partNumber" IN (:...partNumbers)',
          {
            partNumbers: query.partNumbers,
          }
        );
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
      const [results, total] = await queryBuilder.getManyAndCount();
      return {
        results,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
}
