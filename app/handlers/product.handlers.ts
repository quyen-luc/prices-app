import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import { ProductService } from '../service/product.service';

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { ProductEntity } from '../entities/product.entity';

/**
 * Handler class for product-related IPC communications
 */
export class ProductHandlers {
  private static instance: ProductHandlers;
  private productService: ProductService;
  private initialized: boolean = false;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * Get the singleton instance of ProductHandlers
   */
  public static getInstance(): ProductHandlers {
    if (!ProductHandlers.instance) {
      ProductHandlers.instance = new ProductHandlers();
    }
    return ProductHandlers.instance;
  }

  /**
   * Register all IPC handlers
   */
  public registerHandlers(): void {
    if (!this.initialized) {
      console.warn(
        'Registering handlers before initialization. Call initialize() first.'
      );
    }

    // Product handlers
    ipcMain.handle('get-all-products', this.handleGetAllProducts.bind(this));
    ipcMain.handle(
      'get-products-paginated',
      this.handleGetProductsPaginated.bind(this)
    );
    ipcMain.handle('get-product', this.handleGetProduct.bind(this));
    ipcMain.handle('create-product', this.handleCreateProduct.bind(this));
    ipcMain.handle('update-product', this.handleUpdateProduct.bind(this));
    ipcMain.handle('delete-product', this.handleDeleteProduct.bind(this));
    ipcMain.handle('search-products', this.handleSearchProducts.bind(this));

    // File dialog and Excel handlers
    ipcMain.handle('open-file-dialog', this.handleOpenFileDialog.bind(this));
    ipcMain.handle('read-excel-file', this.handleReadExcelFile.bind(this));

    ipcMain.handle(
      'optimize-database-for-bulk',
      this.handleOptimizeDatabaseForBulk.bind(this)
    );
    ipcMain.handle(
      'restore-database-settings',
      this.handleRestoreDatabaseSettings.bind(this)
    );
    ipcMain.handle(
      'batch-insert-products',
      this.handleBatchInsertProducts.bind(this)
    );

    ipcMain.handle('save-file-dialog', this.handleSaveFileDialog.bind(this));

    ipcMain.handle('write-excel-file', this.handleWriteExcelFile.bind(this));
    ipcMain.handle(
      'check-price-list-exists',
      this.handleCheckPriceListExists.bind(this)
    );

    ipcMain.handle(
      'delete-products-by-price-list',
      this.handleDeleteProductsByPriceList.bind(this)
    );
    ipcMain.handle(
      'get-all-price-lists',
      this.handleGetAllPriceLists.bind(this)
    );
    ipcMain.handle(
      'get-distinct-program-names',
      this.handleGetDistinctProgramNames.bind(this)
    );

    ipcMain.handle(
      'get-distinct-currency-codes',
      this.handleGetDistinctCurrencyCodes.bind(this)
    );

    ipcMain.handle(
      'get-distinct-levels',
      this.handleGetDistinctLevels.bind(this)
    );

    ipcMain.handle(
      'get-distinct-part-numbers',
      this.handleGetDistinctPartNumbers.bind(this)
    );

    ipcMain.handle(
      'get-distinct-license-agreement-types',
      this.handleGetDistinctLicenseAgreementTypes.bind(this)
    );

    ipcMain.handle(
      'get-distinct-item-names',
      this.handleGetDistinctItemNames.bind(this)
    );
    console.log('IPC handlers registered');
  }

  /**
   * Unregister all IPC handlers (useful for cleanup)
   */
  public unregisterHandlers(): void {
    ipcMain.removeHandler('get-all-products');
    ipcMain.removeHandler('get-products-paginated');
    ipcMain.removeHandler('get-product');
    ipcMain.removeHandler('create-product');
    ipcMain.removeHandler('update-product');
    ipcMain.removeHandler('delete-product');
    ipcMain.removeHandler('search-products');

    ipcMain.removeHandler('open-file-dialog');
    ipcMain.removeHandler('read-excel-file');
    ipcMain.removeHandler('save-file-dialog');
    ipcMain.removeHandler('write-excel-file');
    ipcMain.removeHandler('optimize-database-for-bulk');
    ipcMain.removeHandler('restore-database-settings');
    ipcMain.removeHandler('batch-insert-products');
    ipcMain.removeHandler('check-price-list-exists');
    ipcMain.removeHandler('delete-products-by-price-list');
    ipcMain.removeHandler('get-all-price-lists');
    ipcMain.removeHandler('get-distinct-program-names');
    ipcMain.removeHandler('get-distinct-currency-codes');
    ipcMain.removeHandler('get-distinct-levels');
    ipcMain.removeHandler('get-distinct-part-numbers');
    ipcMain.removeHandler('get-distinct-license-agreement-types');
    ipcMain.removeHandler('get-distinct-item-names');

    console.log('IPC handlers unregistered');
  }

  private async handleGetAllPriceLists(
    event: IpcMainInvokeEvent
  ): Promise<string[]> {
    try {
      return await this.productService.getAllPriceLists();
    } catch (error) {
      console.error('Error getting all price lists:', error);
      throw error;
    }
  }

  private async handleCheckPriceListExists(
    event: IpcMainInvokeEvent,
    priceListId: string
  ): Promise<boolean> {
    try {
      return await this.productService.priceListExists(priceListId);
    } catch (error) {
      console.error('Error checking price list existence:', error);
      throw error;
    }
  }

  private async handleDeleteProductsByPriceList(
    event: IpcMainInvokeEvent,
    priceListId: string
  ): Promise<number> {
    try {
      return await this.productService.deleteByPriceList(priceListId);
    } catch (error) {
      console.error('Error deleting products by price list:', error);
      throw error;
    }
  }

  // NEW: Handler for paginated products
  private async handleGetProductsPaginated(
    event: IpcMainInvokeEvent,
    params: any
  ): Promise<any> {
    try {
      return await this.productService.getProductsPaginated(params);
    } catch (error) {
      console.error('Error in handler getting paginated products:', error);
      throw error;
    }
  }

  /**
   * Get all products
   */
  private async handleGetAllProducts(): Promise<ProductEntity[]> {
    try {
      return await this.productService.getAllProducts();
    } catch (error) {
      console.error('Error getting products:', error);
      throw this.formatError(error);
    }
  }

  /**
   * Get a product by ID
   */
  private async handleGetProduct(
    event: IpcMainInvokeEvent,
    id: string
  ): Promise<ProductEntity> {
    try {
      return await this.productService.getProductById(id);
    } catch (error) {
      console.error(`Error getting product ${id}:`, error);
      throw this.formatError(error);
    }
  }

  /**
   * Create a new product
   */
  private async handleCreateProduct(
    event: IpcMainInvokeEvent,
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    try {
      return await this.productService.createProduct(productData);
    } catch (error) {
      console.error('Error creating product:', error);
      throw this.formatError(error);
    }
  }

  /**
   * Update an existing product
   */
  private async handleUpdateProduct(
    event: IpcMainInvokeEvent,
    id: string,
    productData: Partial<ProductEntity>
  ): Promise<ProductEntity> {
    try {
      return await this.productService.updateProduct(id, productData);
    } catch (error) {
      console.error(`Error updating product ${id}:`, error);
      throw this.formatError(error);
    }
  }

  /**
   * Delete a product
   */
  private async handleDeleteProduct(
    event: IpcMainInvokeEvent,
    id: string
  ): Promise<{ success: boolean }> {
    try {
      await this.productService.deleteProduct(id);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw this.formatError(error);
    }
  }

  /**
   * Search for products
   */
  private async handleSearchProducts(
    event: IpcMainInvokeEvent,
    query: any
  ): Promise<any> {
    try {
      return await this.productService.searchProducts(query);
    } catch (error) {
      console.error(`Error searching products:`, error);
      throw this.formatError(error);
    }
  }

  /**
   * Format error for IPC transmission
   */
  private formatError(error: any): Error {
    // Create a serializable error object
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } as Error;
  }

  /**
   * Handle file dialog open
   */
  private async handleOpenFileDialog(
    event: IpcMainInvokeEvent,
    options: any
  ): Promise<any> {
    try {
      return await dialog.showOpenDialog(options);
    } catch (error) {
      console.error('Error in open-file-dialog handler:', error);
      throw this.formatError(error);
    }
  }

  /**
   * Handle Excel file reading
   */
  private async handleReadExcelFile(
    event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<any> {
    try {
      console.log(`Reading Excel file: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Read file permissions
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
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
    } catch (error) {
      console.error('Error reading Excel file:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleSaveFileDialog(event, options: any): Promise<any> {
    try {
      return await dialog.showSaveDialog(options);
    } catch (error) {
      console.error('Error in save file dialog:', error);
      return { canceled: true, error: error.message };
    }
  }

  private async handleWriteExcelFile(event: any, params: any): Promise<any> {
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
    } catch (error) {
      console.error('Error writing Excel file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle database optimization for bulk operations
   */
  private async handleOptimizeDatabaseForBulk(): Promise<any> {
    try {
      await this.productService.optimizeDatabaseForBulk();
      return { success: true };
    } catch (error) {
      console.error('Error optimizing database:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle database settings restoration
   */
  private async handleRestoreDatabaseSettings(): Promise<any> {
    try {
      await this.productService.restoreDatabaseSettings();
      return { success: true };
    } catch (error) {
      console.error('Error restoring database settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle batch product insertion
   */
  private async handleBatchInsertProducts(
    event: IpcMainInvokeEvent,
    products: Partial<ProductEntity>[]
  ): Promise<any> {
    try {
      const result = await this.productService.bulkInsertProducts(products);
      return result;
    } catch (error) {
      console.error('Error in batch insertion:', error);
      throw this.formatError(error);
    }
  }

  private async handleGetDistinctProgramNames(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      const result = await this.productService.getAllProgramNames(search);

      return result
        .map((item) => item)
        .filter((name) => name !== null && name !== '');
    } catch (error) {
      console.error('Error getting distinct program names:', error);
      return [];
    }
  }

  private async handleGetDistinctCurrencyCodes(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      const result = await this.productService.getAllCurrencyCodes(search);

      return result
        .map((item) => item)
        .filter((code) => code !== null && code !== '');
    } catch (error) {
      console.error('Error getting distinct currency codes:', error);
      return [];
    }
  }

  private async handleGetDistinctLevels(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      const result = await this.productService.getAllLevels(search);

      return result
        .map((item) => item)
        .filter((level) => level !== null && level !== '');
    } catch (error) {
      console.error('Error getting distinct levels:', error);
      return [];
    }
  }

  private async handleGetDistinctPartNumbers(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      console.log('Getting distinct part numbers with search:', search);
      const result = await this.productService.getAllPartNumbers(search);

      return result
        .map((item) => item)
        .filter((partNumber) => partNumber !== null && partNumber !== '');
    } catch (error) {
      console.error('Error getting distinct part numbers:', error);
      return [];
    }
  }

  private async handleGetDistinctLicenseAgreementTypes(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      const result = await this.productService.getAllLicenseAgreementTypes(
        search
      );

      return result
        .map((item) => item)
        .filter((type) => type !== null && type !== '');
    } catch (error) {
      console.error('Error getting distinct license agreement types:', error);
      return [];
    }
  }

  private async handleGetDistinctItemNames(
    event: IpcMainInvokeEvent,
    search?: string
  ): Promise<string[]> {
    try {
      const result = await this.productService.getAllItemNames(search);

      return result
        .map((item) => item)
        .filter((name) => name !== null && name !== '');
    } catch (error) {
      console.error('Error getting distinct item names:', error);
      return [];
    }
  }
}

export function registerIpcHandlers(): void {
  ProductHandlers.getInstance().registerHandlers();
}

export function unregisterIpcHandlers(): void {
  ProductHandlers.getInstance().unregisterHandlers();
}
