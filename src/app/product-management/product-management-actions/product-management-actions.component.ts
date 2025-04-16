import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ExcelService } from '../../core/services/excel.service';
import { ProductEntity } from '../../../shared/entities/product.entity';
import { ProductImportComponent } from '../product-import/product-import.component';
import { DialogService } from '../../shared/services/dialog.service';
import { ProductSyncStatusComponent } from '../../product-sync-status/product-sync-status.component';
import { ProductService } from '../../services/product.service';
import { NotificationService } from '../../core/services';

@Component({
  selector: 'app-product-management-actions',
  templateUrl: './product-management-actions.component.html',
  styleUrls: ['./product-management-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductManagementActionsComponent {
  @Output() loadProduct = new EventEmitter<number>();
  importInProgress = false;

  constructor(
    private excelService: ExcelService,
    private changeDetectorRef: ChangeDetectorRef,
    private dialogService: DialogService,
    private productService: ProductService,
    private notificationService: NotificationService
  ) {}

  async importFromExcel(): Promise<void> {
    this.importInProgress = true;
    this.changeDetectorRef.markForCheck();

    try {
      // Import products from Excel file
      const importedProducts =
        await this.excelService.importProductsFromDialog();

      if (importedProducts.length === 0) {
        //open erro dialog
        return;
      }

      this.openImportDialog(importedProducts);
    } catch (error) {
      // Open error dialog.
    } finally {
      this.importInProgress = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  openImportDialog(importedProducts: Partial<ProductEntity>[]): void {
    const dialogRef = this.dialogService.open(ProductImportComponent, {
      importedProducts: importedProducts,
    });

    dialogRef.afterClosed.subscribe((result) => {
      if (result && result.success) {
        this.loadProduct.emit();
      }
    });
  }

  // Example usage in a component
  async exportProducts() {
    try {
      // Get products from your service or state
      const products = this.productService.productsValue;

      // Call the export method
      const result = await this.excelService.exportProductsToExcel(products);

      if (result.success) {
        this.notificationService.showSuccess(
          'Products exported successfully!',
          `Saved to: ${result.filePath}`
        );
      } else {
        this.notificationService.showError(
          'Export failed',
          result.error || 'An unknown error occurred'
        );
      }
    } catch (error) {
      console.error('Error in export products:', error);
      this.notificationService.showError(
        'Export failed',
        error.message ?? 'An unknown error occurred'
      );
    }
  }
}
