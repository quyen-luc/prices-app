import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { TextCellEditorComponent } from './text-cell-editor/text-cell-editor.component';
import { NumericCellEditorComponent } from './numeric-cell-editor/numeric-cell-editor.component';
import { ProductListComponent } from './product-list/product-list.component';
import { ProductImportComponent } from './product-import/product-import.component';
import { DialogService } from '../shared/services/dialog.service';
import { ProductManagementActionsComponent } from './product-management-actions/product-management-actions.component';
import { ProductSyncStatusModule } from '../product-sync-status/product-sync-status.module';
import { ProductFilterComponent } from './product-filter/product-filter.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    TextCellEditorComponent,
    NumericCellEditorComponent,
    ProductListComponent,
    ProductImportComponent,
    ProductManagementActionsComponent,
    ProductFilterComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    ReactiveFormsModule,
    AgGridModule,
    ProductSyncStatusModule
  ],
  exports: [
    ProductListComponent,
  ],
  providers: [DialogService]
})
export class ProductManagementModule { }