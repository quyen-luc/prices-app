import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { getRemoteDataSource } from '../../database/remote-database';
import { ProductEntity } from '../../entities/postgresql/product.entity';


export class ProductRepository {
  private repository: Repository<ProductEntity>;

  constructor() {
    // Get the repository from our data source
    this.repository = getRemoteDataSource().getRepository(ProductEntity);
  }

  /**
   * Get all products from the database
   */
  async getAllProducts(): Promise<ProductEntity[]> {
    return this.repository.find({
      order: { changeDate: 'DESC' }
    });
  }

  /**
   * Get a product by its ID
   */
  async getProductById(id: string): Promise<ProductEntity> {
    return this.repository.findOne({ 
      where: { id } 
    });
  }

  /**
   * Create a new product
   */
  async createProduct(productData: Partial<ProductEntity>): Promise<ProductEntity> {
    // Create a new product instance
    const product = this.repository.create({
      ...productData,
      isModifiedLocally: true,
      version: 1,
      lastSyncedAt: null,
      changeDate: productData.changeDate || new Date()
    });

    // Save to database
    return this.repository.save(product);
  }

  /**
   * Update an existing product
   */
  async updateProduct(id: string, productData: Partial<ProductEntity>): Promise<ProductEntity> {
    // Get the current product
    const product = await this.getProductById(id);
    
    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    // Update the product with new data, increment version
    const updatedProduct = {
      ...productData,
      isModifiedLocally: true,
      version: product.version + 1,
      changeDate: productData.changeDate || new Date()
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
      throw new Error(`Product with ID ${id} not found`);
    }

    // Mark as deleted and update version
    await this.repository.update(id, {
      deletedAt: new Date(),
      isModifiedLocally: true,
      version: product.version + 1
    });
  }

  /**
   * Hard delete a product (remove from database)
   */
  async hardDeleteProduct(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Search for products
   */
  async searchProducts(query: string): Promise<ProductEntity[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(product.partNumber LIKE :query OR product.programName LIKE :query OR product.offeringName LIKE :query)',
        { query: `%${query}%` }
      )
      .orderBy('product.changeDate', 'DESC')
      .getMany();
  }

  /**
   * Mark a product as synced
   */
  async markAsSynced(id: string): Promise<void> {
    await this.repository.update(id, {
      isModifiedLocally: false,
      lastSyncedAt: new Date()
    });
  }

  /**
   * Get all locally modified products (for sync)
   */
  async getModifiedProducts(): Promise<ProductEntity[]> {
    return this.repository.find({
      where: { isModifiedLocally: true }
    });
  }

  /**
   * Bulk update products (for sync)
   */
  async bulkSave(products: ProductEntity[]): Promise<ProductEntity[]> {
    return this.repository.save(products);
  }
}