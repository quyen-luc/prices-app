import { Injectable } from '@angular/core';
import { ProductEntity } from '../../../shared/entities/product.entity';
import { ElectronService } from './electron/electron.service';
import { LoadingService } from '../../shared/services/loading.service';
import { convertExcelDateTypeToDate } from '../utils/utils';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  constructor(
    private electronService: ElectronService,
    private loadingService: LoadingService,
    private notificationService: NotificationService
  ) {}

  /**
   * Opens a file dialog and imports products from the selected Excel file
   * @returns Promise with the imported products
   */
  async importProductsFromDialog(): Promise<Partial<ProductEntity>[]> {
    if (!this.electronService.isElectron) {
      throw new Error('This feature is only available in the desktop app');
    }

    try {
      // Open file dialog to select the Excel file
      const result = await this.electronService.ipcRenderer.invoke(
        'open-file-dialog',
        {
          title: 'Select Product List Excel File',
          filters: [
            { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        }
      );

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];

        const fileName = this.extractFileNameWithoutExtension(filePath as string);
        // Check if price list already exists
        const priceListExists = await this.electronService.ipcRenderer.invoke(
          'check-price-list-exists',
          fileName
        );

        if (priceListExists) {
          // Show dialog to let user know this price list already exists
          this.notificationService.showWarning(
            'Price List Already Exists',
            `Products for price list "${fileName}" have already been imported. Please use a different file or delete the existing products first.`
          );
          return [];
        }

        this.loadingService.show('Reading Excel file...');
        // Use the main process to read the Excel file
        const excelData = await this.electronService.ipcRenderer.invoke(
          'read-excel-file',
          filePath
        );

        if (!excelData.success) {
          throw new Error(excelData.error || 'Failed to read Excel file');
        }

        // Process the data
        const products = this.processExcelData(excelData.data as any[], fileName);
        this.loadingService.hide();
        return products;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
      throw new Error(`Failed to open file dialog: ${error.message}`);
    }
  }

  /**
   * Extract filename without extension from a file path
   */
  private extractFileNameWithoutExtension(filePath: string): string {
    // Handle both Windows and Unix-style paths
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = normalizedPath.split('/').pop() || '';

    // Remove extension
    return fileName.replace(/\.[^/.]+$/, '');
  }

  /**
   * Processes raw Excel data into ProductEntity objects
   * @param rawData The raw Excel data
   * @returns Array of product entities
   */
  private processExcelData(
    rawData: any[],
    priceListId: string
  ): Partial<ProductEntity>[] {
    if (!rawData || !rawData.length) {
      return [];
    }

    // Map the Excel data to our ProductEntity
    return rawData
      .filter((row) => this.isValidRow(row))
      .map((row) => this.mapRowToProduct(row, priceListId));
  }

  /**
   * Maps a row from the Excel file to a ProductEntity based on template type
   * @param row The raw Excel row data
   * @returns A mapped ProductEntity
   */
  private mapRowToProduct(row: any, priceList: string): Partial<ProductEntity> {
    return this.mapGenericTemplateRow(row, priceList);
  }

  /**
   * Maps a row from a generic template to a ProductEntity
   * @param row The raw Excel row data
   * @returns A mapped ProductEntity
   */
  private mapGenericTemplateRow(
    row: any,
    priceListId: string
  ): Partial<ProductEntity> {
    // Handle generic format with flexible column matching
    return {
      partNumber: row['Part Number'],
      itemName: row['Item Name'],
      licenseAgreementType: row['License Agreement Type Name'],
      programName: row['Program Name'],
      offeringName: row['Offering Name'],
      level: row['Level'],
      purchaseUnit: row['Unit Count'],
      currencyCode: row['Currency'],
      purchasePeriod: row['Purchase Period'],
      productFamily: row['Product Family'],
      productType: row['Product Type'],
      changeDate: convertExcelDateTypeToDate(row, 'Change Date'),
      netPrice: this.extractPrice(row),
      priceListId: priceListId,
    };
  }

  /**
   * Extracts the price value from different possible column names
   * @param row The raw Excel row data
   * @returns The extracted price as a number
   */
  private extractPrice(row: any): number {
    // Try different column names that might contain price
    const priceValue = row['Net Price'] || 0;

    // Handle price that might be a string with currency symbols
    if (typeof priceValue === 'string') {
      // Remove currency symbols and convert to number
      return (
        parseFloat(priceValue.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
      );
    }

    return parseFloat(priceValue as string) || 0;
  }

  /**
   * Checks if a row from the Excel file contains valid product data
   * @param row The raw Excel row data
   * @returns Boolean indicating if the row is valid
   */
  private isValidRow(row: any): boolean {
    // Skip header rows or empty rows
    if (!row || Object.keys(row).length === 0) {
      return false;
    }

    // Check if any of the potential name fields have a value
    const hasName =
      !!row['Part Number'] ||
      !!row['Item Name'] ||
      !!row['License Agreement Type Name'] ||
      !!row['Program Name'] ||
      !!row['Offering Name'] ||
      !!row['Level'] ||
      !!row['Unit Count'] ||
      !!row['Purchase Period'] ||
      !!row['Product Family'] ||
      !!row['Product Type'] ||
      !!row['Currency'] ||
      !!row['Change Date'] ||
      !!row['Net Price'];

    return hasName;
  }

  /**
   * Exports products to an Excel file
   * @param products The list of products to export
   * @param fileName Optional filename (defaults to 'products_export_[date].xlsx')
   * @returns Promise indicating success or failure
   */
  async exportProductsToExcel(
    products: Partial<ProductEntity>[],
    fileName?: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!this.electronService.isElectron) {
      throw new Error('This feature is only available in the desktop app');
    }

    if (!products || products.length === 0) {
      return { success: false, error: 'No products to export' };
    }

    try {
      this.loadingService.show('Exporting products to Excel...');

      // Create a default filename if not provided
      const defaultFileName = `products_export_${
        new Date().toISOString().split('T')[0]
      }.xlsx`;

      // Open save dialog to choose where to save the file
      const result = await this.electronService.ipcRenderer.invoke(
        'save-file-dialog',
        {
          title: 'Save Products Excel File',
          defaultPath: fileName || defaultFileName,
          filters: [
            { name: 'Excel Files', extensions: ['xlsx'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        }
      );

      if (result.canceled || !result.filePath) {
        this.loadingService.hide();
        return { success: false, error: 'Export canceled by user' };
      }

      // Transform products into a format suitable for Excel
      const excelData = products.map((product) =>
        this.formatProductForExcel(product)
      );

      // Use the IPC to save the Excel file
      const saveResult = await this.electronService.ipcRenderer.invoke(
        'write-excel-file',
        {
          filePath: result.filePath,
          data: excelData,
        }
      );

      this.loadingService.hide();

      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error || 'Failed to save Excel file',
        };
      }

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('Error exporting Excel file:', error);
      this.loadingService.hide();
      return {
        success: false,
        error: `Failed to export Excel file: ${error.message}`,
      };
    }
  }

  /**
   * Formats a product entity for Excel export
   * @param product The product to format
   * @returns An object ready for Excel export
   */
  private formatProductForExcel(
    product: Partial<ProductEntity>
  ): Record<string, any> {
    return {
      'Part Number': product.partNumber || '',
      'Item Name': product.itemName || '',
      'License Agreement Type': product.licenseAgreementType || '',
      'Program Name': product.programName || '',
      'Offering Name': product.offeringName || '',
      Level: product.level || '',
      'Unit Count': product.purchaseUnit || '',
      Currency: product.currencyCode || '',
      'Purchase Period': product.purchasePeriod || '',
      'Product Family': product.productFamily || '',
      'Product Type': product.productType || '',
      'Change Date': product.changeDate
        ? this.formatDateForExcel(product.changeDate)
        : '',
      'Net Price': product.netPrice || 0,
      'Price List': product.priceListId || '',
    };
  }

  /**
   * Formats a date for Excel export
   * @param date The date to format
   * @returns Formatted date string
   */
  private formatDateForExcel(date: Date | string): string {
    if (!date) return '';

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Return in a format Excel recognizes well (MM/DD/YYYY)
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch (e) {
      console.error('Error formatting date for Excel:', e);
      return '';
    }
  }
}
