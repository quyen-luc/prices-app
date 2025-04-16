import { EventEmitter, Output, Input } from '@angular/core';

import { Component } from '@angular/core';

@Component({
  selector: 'app-dialog-base',
  template: ''
})
export abstract class DialogBaseComponent<T = any, R = any> {
  /**
   * Input data for the dialog
   */
  @Input() data?: T;
  
  /**
   * Event emitted when dialog should close with a result
   */
  @Output() dialogClose = new EventEmitter<R>();
  
  /**
   * Closes the dialog with optional result data
   */
  close(result?: R): void {
    this.dialogClose.emit(result);
  }
  
  /**
   * Confirms the dialog (shorthand for close(true) in confirmation dialogs)
   */
  confirm(): void {
    this.dialogClose.emit(true as unknown as R);
  }
  
  /**
   * Cancels the dialog (shorthand for close(false) in confirmation dialogs)
   */
  cancel(): void {
    this.dialogClose.emit(false as unknown as R);
  }
}