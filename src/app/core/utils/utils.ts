
export function convertExcelDateTypeToDate(object: any, field: string) {
  let dateObj: Date;

  // Convert to Date object first (from any format)
  if (typeof object[field] === 'number') {
    // Excel date calculation
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const daysSinceEpoch = object[field];
    const millisecondsSinceEpoch = daysSinceEpoch * 24 * 60 * 60 * 1000;
    dateObj = new Date(excelEpoch.getTime() + millisecondsSinceEpoch);
  } else if (object[field] instanceof Date) {
    dateObj = object[field];
  } else if (typeof object[field] === 'string') {
    dateObj = new Date(object[field] as string);
    if (isNaN(dateObj.getTime())) {
      console.warn(
        `Invalid date string for ${field}: ${object[field]}, setting to null`
      );
      dateObj = null;
    }
  } else {
    console.warn(`Unsupported date format for ${field}, setting to null`);
    dateObj = null;
  }

  return dateObj;
}
