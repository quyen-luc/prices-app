import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { SyncStatusNotificationComponent } from './sync-status-notification.component';

@NgModule({
  declarations: [SyncStatusNotificationComponent],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports:[SyncStatusNotificationComponent],
})
export class SyncStatusModule { }
