import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseStatusComponent } from './database-status.component';

@NgModule({
  declarations: [DatabaseStatusComponent],
  imports: [
    CommonModule
  ],
  exports:[DatabaseStatusComponent],
})
export class DatabaseStatusModule { }
