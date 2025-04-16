import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductSyncStatusComponent } from './product-sync-status.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [ProductSyncStatusComponent],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports:[ProductSyncStatusComponent],
})
export class ProductSyncStatusModule { }
