import { Component, AfterViewInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';

@Component({
  selector: 'app-numeric-cell-editor',
  template: `
    <input
      #input
      type="number"
      step="0.01"
      [value]="value"
      (input)="onChange($event)"
      (keydown)="onKeyDown($event)"
      class="ag-cell-edit-input"
    />
  `,
  styles: [
    `
      .ag-cell-edit-input {
        width: 100%;
        height: 100%;
        padding: 2px 4px;
        outline: none;
        border: 1px solid #0091ea;
        border-radius: 3px;
      }
    `,
  ],
})
export class NumericCellEditorComponent
  implements ICellEditorAngularComp, AfterViewInit
{
  private params: ICellEditorParams;
  public value: number;

  // Reference to the input element
  private inputElement: HTMLInputElement;

  agInit(params: ICellEditorParams): void {
    this.params = params;
    this.value = params.value;
  }

  // Get reference to input after view is initialized
  ngAfterViewInit() {
    // Focus on the input element and select all text
    this.inputElement = document.querySelector('input') as HTMLInputElement;
    if (this.inputElement) {
      this.inputElement.focus();
      this.inputElement.select();
    }
  }

  // Method called when input changes
  onChange(event: any): void {
    this.value = parseFloat(event.target.value);
  }

  // Handle key events
  onKeyDown(event: KeyboardEvent): void {
    // Allow only numeric input, navigation keys, and decimal point
    const allowedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'Tab',
      'Enter',
      '.',
      ',',
    ];

    if (!allowedKeys.includes(event.key) && isNaN(Number(event.key))) {
      event.preventDefault();
    }

    // Stop editing on Enter or Tab
    if (event.key === 'Enter' || event.key === 'Tab') {
      this.params.stopEditing();
    }
  }

  // Method required by AG Grid to get the final value
  getValue(): any {
    return this.value;
  }

  // Method to determine if the edit should be started immediately
  isCancelBeforeStart(): boolean {
    return false;
  }

  // Method to determine if the edit should be canceled after a given action
  isCancelAfterEnd(): boolean {
    return false;
  }
}
