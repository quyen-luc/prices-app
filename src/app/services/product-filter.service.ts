import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ElectronService } from '../core/services';
import { ProductQuery } from '../core/models/product-query.model';

@Injectable({
  providedIn: 'root',
})
export class ProductFilterService {
  constructor(private electronService: ElectronService) {}

  /**
   * Get all distinct program names
   * @returns Observable of distinct program names
   */
  getDistinctProgramNames(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke(
        'get-distinct-program-names',
        search
      )
    ).pipe(
      map((result: string[]) => result.sort()),
      catchError((error) => {
        console.error('Error getting distinct program names:', error);
        return [];
      })
    );
  }

  /**
   * Get all distinct currency codes
   * @returns Observable of distinct currency codes
   */
  getDistinctCurrencyCodes(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke(
        'get-distinct-currency-codes',
        search
      )
    ).pipe(
      map((result: string[]) => result.sort()),
      catchError((error) => {
        console.error('Error getting distinct currency codes:', error);
        return [];
      })
    );
  }

  /**
   * Get all distinct levels
   * @returns Observable of distinct levels
   */
  getDistinctLevels(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke('get-distinct-levels')
    ).pipe(
      map((result: string[]) => result.filter((level) => level !== null)),
      catchError((error) => {
        console.error('Error getting distinct levels:', error);
        return [];
      })
    );
  }

  /**
   * Get all distinct part numbers
   * @param search Optional search term to filter results
   * @returns Observable of distinct part numbers
   */
  getDistinctPartNumbers(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke(
        'get-distinct-part-numbers',
        search
      )
    ).pipe(
      map((result: string[]) => result.sort()),
      catchError((error) => {
        console.error('Error getting distinct part numbers:', error);
        return [];
      })
    );
  }

  /**
   * Get all distinct license agreement types
   * @returns Observable of distinct license agreement types
   */
  getDistinctLicenseAgreementTypes(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke(
        'get-distinct-license-agreement-types',
        search
      )
    ).pipe(
      map((result: string[]) => result.sort()),
      catchError((error) => {
        console.error('Error getting distinct license agreement types:', error);
        return [];
      })
    );
  }

  /**
   * Get all distinct item names
   * @param search Optional search term to filter results
   * @returns Observable of distinct item names
   */
  getDistinctItemNames(search?: string): Observable<string[]> {
    return from(
      this.electronService.ipcRenderer.invoke('get-distinct-item-names', search)
    ).pipe(
      map((result: string[]) => result.filter((name) => name !== null).sort()),
      catchError((error) => {
        console.error('Error getting distinct item names:', error);
        return [];
      })
    );
  }

  /**
   * Search products with filters
   * @param query The filter query
   * @returns Observable of product results
   */
  searchProducts(query: ProductQuery): Observable<any> {
    return from(
      this.electronService.ipcRenderer.invoke('search-products', query)
    ).pipe(
      map((result: any) => result),
      catchError((error) => {
        console.error('Error searching products:', error);
        return [];
      })
    );
  }

  /**
   * Build a query object from filter form values
   * @param filterValues Values from the filter form
   * @returns A structured query object
   */
  buildQuery(filterValues: any): ProductQuery {
    const query: ProductQuery = {};

    // Only add properties that have values
    if (filterValues.programName) {
      query.programName = filterValues.programName;
    }

    if (filterValues.licenseAgreementTypes) {
      query.licenseAgreementTypes = filterValues.licenseAgreementTypes;
    }

    if (filterValues.partNumber && filterValues.partNumber.length > 0) {
      query.partNumbers = Array.isArray(filterValues.partNumber)
        ? filterValues.partNumber
        : [filterValues.partNumber];
    }

    if (filterValues.itemName && filterValues.itemName.length > 0) {
      query.itemNames = Array.isArray(filterValues.itemName)
        ? filterValues.itemName
        : [filterValues.itemName];
    }

    if (filterValues.levels) {
      query.levels = filterValues.levels;
    }

    if (filterValues.currencyCode) {
      query.currencyCode = filterValues.currencyCode;
    }

    // Add default pagination and sorting
    query.page = 1;
    query.pageSize = 50;
    query.sortField = 'partNumber';
    query.sortDirection = 'ASC';

    return query;
  }
}
