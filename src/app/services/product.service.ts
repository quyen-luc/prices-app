// src/app/services/product.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProductEntity } from '../../shared/entities/product.entity';
import { ElectronService } from '../core/services';
import { ProductQuery } from '../core/models/product-query.model';

export interface ProductPaginationParams {
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

export interface ProductPaginationResult {
  rows: ProductEntity[];
  totalCount: number;
  page: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private products = new BehaviorSubject<ProductEntity[]>([]);
  products$ = this.products.asObservable();

  private selectedProduct = new BehaviorSubject<ProductEntity>(null);
  selectedProduct$ = this.selectedProduct.asObservable();

  private loading = new BehaviorSubject<boolean>(false);
  loading$ = this.loading.asObservable();

  get importProgress$(): Observable<number> {
    return this.importProgressSubject.asObservable();
  }

  get productsValue(): ProductEntity[] {
    return this.products.value;
  }

  private importProgressSubject = new BehaviorSubject<number>(0);

  private _totalCount = new BehaviorSubject<number>(0);
  private _currentPage = new BehaviorSubject<number>(1);
  private _totalPages = new BehaviorSubject<number>(0);

  public totalCount$ = this._totalCount.asObservable();
  public currentPage$ = this._currentPage.asObservable();
  public totalPages$ = this._totalPages.asObservable();

  constructor(private electronService: ElectronService) {}

  /**
   * Load products with pagination
   */
  async loadProducts(params?: ProductPaginationParams): Promise<void> {
    if (!this.electronService.isElectron) {
      console.error('Electron service not available');
      return;
    }


    try {
      const paginationParams = params || {
        page: this._currentPage.value,
        pageSize: 50, // Default page size
        sortField: 'updatedAt', // Default sort
        sortDirection: 'DESC', // Default direction
      };

      const result = await this.electronService.ipcRenderer.invoke(
        'get-products-paginated',
        paginationParams
      );

      this.products.next(result.rows);
      this._totalCount.next(result.totalCount);
      this._currentPage.next(result.page);
      this._totalPages.next(result.totalPages);
    } catch (error) {
      console.error('Error loading products:', error);
      // Keep previous state on error
    } finally {
      this.loading.next(false);
    }
  }

  /**
   * Get current pagination state
   */
  getPaginationState() {
    return {
      currentPage: this._currentPage.value,
      totalPages: this._totalPages.value,
      totalCount: this._totalCount.value,
    };
  }

  /**
   * Get all products for export
   */
  async getProductsForExport(): Promise<ProductEntity[]> {
    if (!this.electronService.isElectron) {
      throw new Error('Electron service not available');
    }

    try {
      return await this.electronService.ipcRenderer.invoke('get-all-products');
    } catch (error) {
      console.error('Error getting products for export:', error);
      throw error;
    }
  }

  async getProductById(id: string): Promise<ProductEntity> {
    if (!this.electronService.ipcRenderer) {
      return null;
    }

    try {
      const product = await this.electronService.ipcRenderer.invoke(
        'get-product',
        id
      );
      this.selectedProduct.next(product);
      return product;
    } catch (error) {
      console.error(`Error getting product ${id}:`, error);
      return null;
    }
  }

  async createProduct(
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    if (!this.electronService.ipcRenderer) {
      return null;
    }

    this.loading.next(true);
    try {
      const newProduct = await this.electronService.ipcRenderer.invoke(
        'create-product',
        productData
      );
      await this.loadProducts(); // Reload products after creation
      return newProduct;
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    } finally {
      this.loading.next(false);
    }
  }

  async updateProduct(
    id: string,
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    if (!this.electronService.ipcRenderer) {
      return null;
    }

    this.loading.next(true);
    try {
      const updatedProduct = await this.electronService.ipcRenderer.invoke(
        'update-product',
        id,
        productData
      );
      await this.loadProducts(); // Reload products after update
      return updatedProduct;
    } catch (error) {
      console.error(`Error updating product ${id}:`, error);
      return null;
    } finally {
      this.loading.next(false);
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    if (!this.electronService.ipcRenderer) {
      return false;
    }

    this.loading.next(true);
    try {
      await this.electronService.ipcRenderer.invoke('delete-product', id);
      await this.loadProducts(); // Reload products after deletion
      return true;
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      return false;
    } finally {
      this.loading.next(false);
    }
  }

  async searchProducts(query: ProductQuery): Promise<ProductEntity[]> {
    if (!this.electronService.ipcRenderer || !query) {
      return this.products.value;
    }


    this.loading.next(true);
    try {
      const result = await this.electronService.ipcRenderer.invoke(
        'search-products',
        query
      );


      this.products.next(result.results);
      this._totalCount.next(result.pagination.total);
      this._currentPage.next(result.pagination.page);
      this._totalPages.next(result.pagination.totalPages);
      return result;
    } catch (error) {
      console.error(`Error searching products:`, error);
      return this.products.value;
    } finally {
      this.loading.next(false);
    }
  }

  /**
   * Import products in batches
   * @param products Array of products to import
   * @returns Promise with import results
   */
  async bulkCreateProducts(
    products: ProductEntity[]
  ): Promise<{ count: number; failed: number }> {
    if (!this.electronService.ipcRenderer) {
      throw new Error('Electron IPC not available');
    }

    if (!products || products.length === 0) {
      return { count: 0, failed: 0 };
    }

    this.loading.next(true);

    try {
      // First optimize database for bulk operations
      await this.electronService.ipcRenderer.invoke(
        'optimize-database-for-bulk'
      );

      // Process in batches to keep UI responsive
      const batchSize = 500; // Adjust based on performance testing
      const batches = this.createBatches(products, batchSize);

      let totalImported = 0;
      let totalFailed = 0;

      for (let i = 0; i < batches.length; i++) {
        // Process each batch
        const result = await this.electronService.ipcRenderer.invoke(
          'batch-insert-products',
          batches[i]
        );

        totalImported += result.imported;
        totalFailed += result.failed;

        // Update progress for subscribers
        const progress = Math.round(((i + 1) / batches.length) * 100);
        this.importProgressSubject.next(progress);

        // Small delay to keep UI responsive
        if (i < batches.length - 1) {
          await this.delay(50);
        }
      }

      // Restore database settings
      await this.electronService.ipcRenderer.invoke(
        'restore-database-settings'
      );

      // Reload products after import
      await this.loadProducts();

      return {
        count: totalImported,
        failed: totalFailed,
      };
    } catch (error) {
      console.error('Error in bulk product import:', error);

      // Ensure database settings are restored on error
      try {
        await this.electronService.ipcRenderer.invoke(
          'restore-database-settings'
        );
      } catch (restoreError) {
        console.error('Error restoring database settings:', restoreError);
      }

      throw error;
    } finally {
      this.loading.next(false);
    }
  }

  /**
   * Split array into batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
