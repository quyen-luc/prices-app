import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridReadyEvent,
  GridApi,
  Column,
  CellEditingStoppedEvent,
  ClientSideRowModelModule,
  Module,
  ValidationModule,
  RowApiModule,
  CustomEditorModule,
  PaginationModule,
  CustomFilterModule,
  SortChangedEvent,
  FilterChangedEvent,
  RowSelectionModule,
} from 'ag-grid-community';
import { ElectronService } from '../../core/services';
import { TextCellEditorComponent } from '../text-cell-editor/text-cell-editor.component';
import { NumericCellEditorComponent } from '../numeric-cell-editor/numeric-cell-editor.component';
import { ProductService } from '../../services/product.service';
import { Observable, firstValueFrom, map } from 'rxjs';
import { ExcelService } from '../../core/services/excel.service';
import { ProductEntity } from '../../../shared/entities/product.entity';
import { LoadingService } from '../../shared/services/loading.service';
import { NotificationService } from '../../core/services/notification.service';
import { FormControl, FormGroup } from '@angular/forms';
import { ProductFilterService } from '../../services/product-filter.service';
import { ProductQuery } from '../../core/models/product-query.model';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent implements OnInit, OnDestroy {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  // Use observables with async pipe
  products$: Observable<ProductEntity[]>;
  loading$: Observable<boolean>;
  totalCount$: Observable<number>;
  currentPage$: Observable<number>;
  totalPages$: Observable<number>;

  // Grid state
  public gridApi!: GridApi;
  public gridColumnApi!: Column;
  public lastSyncDate: Date | null = null;
  public pendingSyncCount = 0;

  // Pagination state - needed for making API calls
  public pageSize = 50;
  private sortField?: string;
  private sortDirection?: 'ASC' | 'DESC';
  private filters: Partial<ProductQuery> = {};

  modules: Module[] = [
    ClientSideRowModelModule,
    ValidationModule,
    RowApiModule,
    CustomEditorModule,
    PaginationModule,
    CustomFilterModule,
    RowSelectionModule,
  ];

  Math = Math;

  // Column Definitions
  public columnDefs: ColDef[] = [
    {
      field: 'partNumber',
      headerName: 'Part Number',
      sortable: true,
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'itemName',
      headerName: 'Item Name',
      sortable: true,
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'licenseAgreementType',
      headerName: 'License Agreement',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'programName',
      headerName: 'Program',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'offeringName',
      headerName: 'Offering',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'level',
      headerName: 'Level',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'netPrice',
      headerName: 'Net Price',
      sortable: true,
      editable: true,
      cellEditor: NumericCellEditorComponent,
      valueFormatter: (params) => `${params.value?.toFixed(2) || '0.00'}`,
    },
    {
      field: 'productFamily',
      headerName: 'Product Family',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'productType',
      headerName: 'Product Type',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'currencyCode',
      headerName: 'Currency',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'purchaseUnit',
      headerName: 'Purchase Unit',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'purchasePeriod',
      headerName: 'Period',
      editable: true,
      cellEditor: TextCellEditorComponent,
    },
    {
      field: 'isModifiedLocally',
      headerName: 'Sync Status',
      editable: false,
      cellRenderer: (params) => {
        if (params.value) {
          return `<span class="badge-pending">Pending Sync</span>`;
        } else {
          return `<span class="badge-synced">Synced</span>`;
        }
      },
    },
    {
      field: 'changeDate',
      headerName: 'Change Date',
      sortable: true,
      valueFormatter: (params) => {
        if (params.value === null) return '-';
        const date = new Date(params.value);
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      field: 'priceListId',
      headerName: 'Price List',
      sortable: true,
      cellEditor: TextCellEditorComponent,
    },
  ];

  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 120,
    resizable: true,
    editable: true,
    sortable: true,
  };

  public frameworkComponents: any;

  constructor(
    public productService: ProductService,
    private electronService: ElectronService,
    private changeDetectorRef: ChangeDetectorRef,
    private loadingService: LoadingService,
    private notificationService: NotificationService,
    private excelService: ExcelService
  ) {
    this.frameworkComponents = {
      textCellEditor: TextCellEditorComponent,
      numericCellEditor: NumericCellEditorComponent,
    };

    // Initialize observables
    this.products$ = this.productService.products$.pipe(
      map((products) =>
        products.map((product) => ({
          ...product,
          isModifiedLocally: product.isModifiedLocally || false,
        }))
      )
    );
    this.loading$ = this.productService.loading$;
    this.totalCount$ = this.productService.totalCount$;
    this.currentPage$ = this.productService.currentPage$;
    this.totalPages$ = this.productService.totalPages$;
  }

  ngOnInit(): void {
    // Listen for product sync status changes
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.on(
        'product-sync-status-changed',
        (event, status) => {
          if (status.status === 'completed') {
            this.loadProducts();
            this.getProductSyncStatus();
            this.changeDetectorRef.markForCheck();
          }
        }
      );
    }

    // Initial data load
    this.loadProducts();
    this.getProductSyncStatus();
  }

  ngOnDestroy(): void {
    // Remove event listeners
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.removeAllListeners(
        'product-sync-status-changed'
      );
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  async loadProducts(page?: number): Promise<void> {
    try {
      this.loadingService.show('Loading products...');

      // Get current page from service if not provided using firstValueFrom
      const currentPage =
        page !== undefined
          ? page
          : await firstValueFrom(
              this.productService.currentPage$.pipe(map((p) => p || 1))
            );

      
      await this.productService.searchProducts({
        ...this.filters,
        page: currentPage,
        pageSize: this.pageSize,
        sortField: this.sortField,
        sortDirection: this.sortDirection,
      });

      this.loadingService.hide();
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error loading products:', error);
      this.notificationService.showError(
        'Failed to load products',
        error.message || 'An unknown error occurred'
      );
      this.loadingService.hide();
    }
  }

  // Pagination handlers
  onPageChanged(page: number): void {
    this.loadProducts(page);
  }

  onPageSizeChanged(pageSize: number): void {
    this.pageSize = pageSize;
    this.loadProducts(1); // Reset to first page when changing page size
  }

  // Sorting handler
  // Sorting handler
  onSortChanged(event: SortChangedEvent): void {
    // The correct way to get sort model in newer versions of AG Grid
    const sortState = event.api.getColumnState().filter((col) => !!col.sort);

    const sortColumns = sortState.filter((column) => column.sort);

    if (sortColumns.length > 0) {
      this.sortField = sortColumns[0].colId;
      this.sortDirection = sortColumns[0].sort?.toUpperCase() as 'ASC' | 'DESC';
    } else {
      this.sortField = undefined;
      this.sortDirection = undefined;
    }

    this.loadProducts(1); // Reset to first page when sorting changes
  }

  // Filter handler
  onFilterChanged(event: FilterChangedEvent): void {
    const filterModel = event.api.getFilterModel();
    this.filters = {}; // Reset filters

    // Convert AG Grid filter model to our format
    if (filterModel) {
      Object.keys(filterModel).forEach((key) => {
        const filter = filterModel[key];

        // Handle different filter types
        if (filter.filterType === 'text') {
          this.filters[key] = filter.filter;
        } else if (filter.filterType === 'number') {
          // Handle number filters based on type
          switch (filter.type) {
            case 'equals':
              this.filters[key] = filter.filter;
              break;
            case 'greaterThan':
              this.filters[`${key}_gt`] = filter.filter;
              break;
            case 'lessThan':
              this.filters[`${key}_lt`] = filter.filter;
              break;
            // Add other cases as needed
          }
        }
      });
    }

    this.loadProducts(1); // Reset to first page when filters change
  }

  async getProductSyncStatus(): Promise<void> {
    if (!this.electronService.isElectron) return;

    try {
      const status = await this.electronService.ipcRenderer.invoke(
        'get-product-sync-status'
      );
      this.pendingSyncCount = status.pendingUploads;

      if (status.lastSyncTime) {
        this.lastSyncDate = new Date(status.lastSyncTime);
      }

      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error getting product sync status:', error);
    }
  }

  // Handle cell editing stopped event
  async onCellEditingStopped(event: CellEditingStoppedEvent): Promise<void> {
    try {
      // Only proceed if value actually changed
      if (event.oldValue !== event.newValue) {
        const productData = {
          [event.column.getColId()]: event.newValue,
        };

        await this.productService.updateProduct(event.data.id, productData);
        this.getProductSyncStatus(); // Refresh sync status count
      }
    } catch (error) {
      console.error('Error updating product:', error);
      this.notificationService.showError(
        'Failed to update product',
        error.message || 'An unknown error occurred'
      );

      // Revert cell to original value on error
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: [event.column.getColId()],
        force: true,
      });
    }
  }

  async onDeleteProduct(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await this.productService.deleteProduct(id);
        await this.loadProducts(); // Will use current page
        await this.getProductSyncStatus();
      } catch (error) {
        console.error('Error deleting product:', error);
        this.notificationService.showError(
          'Failed to delete product',
          error.message || 'An unknown error occurred'
        );
      }
    }
  }

  // Add this method to your component class
  onProductFiltersChanged(query: ProductQuery): void {
    // Set the filters from the query
    this.filters = query;

    // Set sort field and direction if provided in the query
    if (query.sortField) {
      this.sortField = query.sortField;
    }

    if (query.sortDirection) {
      this.sortDirection = query.sortDirection;
    }

    // Set page size if provided
    if (query.pageSize) {
      this.pageSize = query.pageSize;
    }

    // Load the first page with new filters
    this.loadProducts(1);
  }
}
