import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormControl,
} from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  map,
  startWith,
  tap,
} from 'rxjs/operators';

@Component({
  selector: 'app-autocomplete-dropdown',
  templateUrl: './autocomplete-dropdown.component.html',
  styleUrls: ['./autocomplete-dropdown.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteDropdownComponent),
      multi: true,
    },
  ],
})
export class AutocompleteDropdownComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() placeholder = 'Search...';
  @Input() multiple = false;
  @Input() clearable = true;
  @Input() loading = false;
  @Input() disabled = false;
  @Input() maxHeight = '250px';
  // Add new property to enable bulk paste
  @Input() allowBulkPaste = false;
  @ViewChild('inputElement') inputElement: ElementRef;

  // Function that returns an Observable of items based on search term
  @Input() itemsLoader: (search: string) => Observable<string[]> = () => of([]);

  @Output() selectionChange = new EventEmitter<string | string[]>();

  searchControl = new FormControl('');
  filteredOptions$: Observable<string[]>;
  selectedItems: string[] = [];
  isDropdownOpen = false;

  private destroy$ = new Subject<void>();
  private onChange: any = () => {};
  private onTouched: any = () => {};

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Set up search with debounce
    this.filteredOptions$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((search) => {
        // Only search if dropdown is open
        if (!this.isDropdownOpen) {
          return of([]);
        }
        return this.itemsLoader(search || '');
      }),
      map((options) => {
        // Filter out already selected items in multiple selection mode
        if (this.multiple) {
          return options.filter(
            (option) => !this.selectedItems.includes(option)
          );
        }
        return options;
      })
    );

    // Handle display logic for single selection mode
    if (!this.multiple) {
      // When in single selection mode, we need to update the search control
      // with the selected value for display purposes
      this.searchControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          // If we're selecting from dropdown, we don't want to change anything
          if (this.isSettingValueFromSelection) return;

          // If the input value doesn't match our selection, clear the selection
          if (value !== this.displayValue && this.selectedItems.length > 0) {
            this.selectedItems = [];
            this.onChange(null);
            this.selectionChange.emit(null);
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Used for single selection to avoid feedback loops
  private isSettingValueFromSelection = false;


  // Add bulk paste handler
  onPaste(event: ClipboardEvent): void {
    // Only process if bulk paste is allowed and we're in multiple selection mode
    if (!this.allowBulkPaste || !this.multiple) {
      return;
    }

    // Prevent default paste behavior
    event.preventDefault();

    // Get pasted text
    const pastedText = event.clipboardData.getData('text');

    // Skip if empty
    if (!pastedText.trim()) {
      return;
    }

    // Process the pasted text - split by newlines, tabs, commas, or multiple spaces
    const items = pastedText
      .split(/[\n\r\t,]+|\s{2,}/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Add unique items that don't already exist in the selection
    const newItems = items.filter((item) => !this.selectedItems.includes(item));

    if (newItems.length > 0) {
      // Add new items to selection
      this.selectedItems = [...this.selectedItems, ...newItems];
      this.onChange(this.selectedItems);
      this.selectionChange.emit(this.selectedItems);

      // Clear the input field
      this.searchControl.setValue('', { emitEvent: false });
    }
  }

  // When input is focused, show the dropdown
  onInputFocus(): void {
    if (!this.disabled) {
      this.isDropdownOpen = true;
      this.onTouched();
    }
  }

  // Toggle dropdown visibility
  toggleDropdown(event?: MouseEvent): void {
    if (!this.disabled) {
      this.isDropdownOpen = !this.isDropdownOpen;
      if (this.isDropdownOpen) {
        this.onTouched();
      }
    }
  }

  // Handle selecting an item
  selectItem(item: string): void {
    if (this.multiple) {
      // For multiple selection, add to array if not already there
      if (!this.selectedItems.includes(item)) {
        this.selectedItems = [...this.selectedItems, item];
        this.onChange(this.selectedItems);
        this.selectionChange.emit(this.selectedItems);
      }

      // Clear search input after selection in multiple mode
      this.searchControl.setValue('', { emitEvent: false });
    } else {
      // For single selection, replace current value
      this.selectedItems = [item];
      this.isDropdownOpen = false;

      // Update input value with selection
      this.isSettingValueFromSelection = true;
      this.searchControl.setValue(item, { emitEvent: false });
      this.isSettingValueFromSelection = false;

      this.onChange(item);
      this.selectionChange.emit(item);
    }
  }

  // Remove a selected item (for multiple select)
  removeItem(item: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    this.selectedItems = this.selectedItems.filter((i) => i !== item);
    this.onChange(this.multiple ? this.selectedItems : null);
    this.selectionChange.emit(this.multiple ? this.selectedItems : null);
  }

  // Clear selection and search input
  clearAll(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    this.selectedItems = [];
    this.searchControl.setValue('', { emitEvent: false });
    this.onChange(this.multiple ? [] : null);
    this.selectionChange.emit(this.multiple ? [] : null);
  }

  // Detect click outside to close dropdown
  onClickOutside(event: MouseEvent): void {
    this.isDropdownOpen = false;
  }

  // Getter for display value
  get displayValue(): string {
    if (this.multiple) {
      return ''; // Multiple selection shows tags, not a single value
    }
    return this.selectedItems.length ? this.selectedItems[0] : '';
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    if (value === null || value === undefined) {
      this.selectedItems = [];
      this.searchControl.setValue('', { emitEvent: false });
    } else if (this.multiple && Array.isArray(value)) {
      this.selectedItems = [...value];
      this.searchControl.setValue('', { emitEvent: false });
    } else if (!this.multiple) {
      this.selectedItems = [value];
      this.searchControl.setValue(value, { emitEvent: false });
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.searchControl.disable();
    } else {
      this.searchControl.enable();
    }
  }
}
