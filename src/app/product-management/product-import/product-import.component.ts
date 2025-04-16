import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { ExcelService } from '../../core/services/excel.service';
import { ProductService } from '../../services/product.service';
import { ProductEntity } from '../../../shared/entities/product.entity';
import { DialogBaseComponent } from '../../shared/abstracts/dialog-base.component';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../core/services';

interface ImportResult {
  count: number;
  success: boolean;
  failed: number;
}

@Component({
  selector: 'app-product-import',
  templateUrl: './product-import.component.html',
  styleUrls: ['./product-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImportComponent extends DialogBaseComponent<
  any,
  ImportResult
> implements OnInit {
  @Input() data: any;


  // Note: We keep this for backward compatibility, but dialogClose will be our primary way
  // to communicate with the dialog service
  @Output() importCompleted = new EventEmitter<number>();

  importInProgress = false;
  importError: string | null = null;
  importSuccess = false;
  importedProducts: Partial<ProductEntity>[] = [];
  // Add these properties and the cleanup
  importProgress: number = 0;
  showProgressBar: boolean = false;
  importCancellable: boolean = false;
  importStats: any = {};
  progressSubscription: Subscription;
  statusSubscription: Subscription;

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.importedProducts = this.data?.importedProducts || [];

  }

  ngOnDestroy(): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }

  }

  /**
   * Close the dialog without any result
   */
  closeDialog(): void {
    this.close();
  }


  /**
   * Confirms the import and saves products to the database
   */
  async confirmImport(): Promise<void> {
    if (!this.importedProducts.length) {
      return;
    }

    this.importInProgress = true;
    this.showProgressBar = true;
    this.importProgress = 0;
    this.cdr.markForCheck();

    try {
      // Subscribe to the progress updates
      this.progressSubscription = this.productService.importProgress$.subscribe(
        (progress) => {
          this.importProgress = progress;
          this.cdr.markForCheck();
        }
      );

      // Start the batch import process
      const result = await this.productService.bulkCreateProducts(
        this.importedProducts as ProductEntity[]
      );

      // Mark import as successful
      this.importSuccess = true;

      // For backward compatibility
      this.importCompleted.emit(result.count);
      this.notificationService.showSuccess(
        'Import Successful',
        `${result.count} products imported successfully.`
      );

      // Close dialog with result
      this.close({
        count: result.count,
        failed: result.failed,
        success: true,
      });
    } catch (error) {
      this.importError = `Error importing products: ${error.message}`;
      console.error('Import error:', error);
    } finally {
      this.importInProgress = false;
      this.showProgressBar = false;

      // Clean up subscription
      if (this.progressSubscription) {
        this.progressSubscription.unsubscribe();
      }

      this.cdr.markForCheck();
    }
  }

  /**
   * Cancel the current import
   */
  cancelImport(): void {
    this.close();
  }

  public resetState(): void {
    this.importedProducts = [];
    this.importError = null;
    this.importSuccess = false;
    this.importInProgress = false;
    this.cdr.markForCheck();
  }
}
