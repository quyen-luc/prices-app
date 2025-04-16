export interface ProductQuery {
    programName?: string;
    licenseAgreementTypes?: string;
    partNumbers?: string[];
    itemNames?: string[];
    levels?: string;
    currencyCode?: string;
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortDirection?: 'ASC' | 'DESC';
  }