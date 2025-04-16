import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';

@Component({
  selector: 'app-text-cell-editor',
  templateUrl: './text-cell-editor.component.html',
  styleUrls: ['./text-cell-editor.component.scss'],
})
export class TextCellEditorComponent
  implements ICellEditorAngularComp, AfterViewInit
{
  @ViewChild('input') inputElement!: ElementRef<HTMLInputElement>;

  private params: ICellEditorParams;
  public value: string;

  // Reference to the input element

  agInit(params: ICellEditorParams): void {
    console.log('agInit', params);
    this.params = params;
    this.value = params.value;
  }

  // Get reference to input after view is initialized
  ngAfterViewInit() {
    // Focus on the input element
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  // Method called when input changes
  onChange(event: any): void {
    this.value = event.target.value;
  }

  // Handle key events
  onKeyDown(event: KeyboardEvent): void {
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
