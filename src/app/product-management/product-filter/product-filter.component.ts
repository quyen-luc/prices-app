import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ProductFilterService } from '../../services/product-filter.service';
import { ProductQuery } from '../../core/models/product-query.model';

@Component({
  selector: 'app-product-filter',
  templateUrl: './product-filter.component.html',
  styleUrls: ['./product-filter.component.scss'],
})
export class ProductFilterComponent implements OnInit {
  @Output() filtersChanged = new EventEmitter<ProductQuery>();

  filterForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private productFilterService: ProductFilterService
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      programName: [null],
      licenseAgreementTypes: [null],
      partNumber: [[]],
      itemName: [[]],
      levels: [null],
      currencyCode: [null],
    });
  }

  // Use these methods to load items for each dropdown
  loadProgramNames = (search: string) =>
    this.productFilterService.getDistinctProgramNames(search);
  loadLicenseTypes = (search: string) =>
    this.productFilterService.getDistinctLicenseAgreementTypes(search);
  loadPartNumbers = (search: string) =>
    this.productFilterService.getDistinctPartNumbers(search);
  loadItemNames = (search: string) =>
    this.productFilterService.getDistinctItemNames(search);
  loadLevels = (search: string) =>
    this.productFilterService.getDistinctLevels(search);
  loadCurrencyCodes = (search: string) =>
    this.productFilterService.getDistinctCurrencyCodes(search);

  resetFilters(): void {
    this.filterForm.reset();
    this.applyFilters(); // Apply empty filters to reset the list
  }

  applyFilters(): void {
    
    // Build query from form values
    const query = this.productFilterService.buildQuery(this.filterForm.value);
    
    // Emit to parent component to handle the filtering
    this.filtersChanged.emit(query);
    
  }
}
