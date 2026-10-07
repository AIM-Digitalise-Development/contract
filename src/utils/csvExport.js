/**
 * Enterprise CSV Exporter Utility
 * Respects all active filters: Search, Product, Employee, Client, Godown, Status, Date range, etc.
 * Column order standard: ID/Serial Number -> Date -> Other information.
 * Strips leading '#' from IDs and transactions.
 * Supports both function signatures:
 *   1. exportToCSV({ filename, columns, data })
 *   2. exportToCSV(filename, columns, data)
 */

export function exportToCSV(arg1, arg2, arg3) {
  let filename = 'export.csv';
  let columns = [];
  let data = [];

  if (typeof arg1 === 'string') {
    // Positional signature: exportToCSV(filename, columns, data)
    filename = arg1;
    columns = Array.isArray(arg2) ? arg2 : [];
    data = Array.isArray(arg3) ? arg3 : [];
  } else if (arg1 && typeof arg1 === 'object') {
    // Object signature: exportToCSV({ filename, columns, data })
    filename = arg1.filename || 'export.csv';
    columns = Array.isArray(arg1.columns) ? arg1.columns : (Array.isArray(arg1.headers) ? arg1.headers : []);
    data = Array.isArray(arg1.data) ? arg1.data : [];
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No records to export with the currently applied filters.');
  }

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    // Strip unnecessary leading '#' if present on identifiers
    if (str.startsWith('#')) {
      str = str.replace(/^#+/, '');
    }
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  };

  // If no columns provided, generate columns from keys of the first item
  const resolvedColumns = columns.length > 0 
    ? columns 
    : Object.keys(data[0] || {}).map(key => ({ key, label: key.replace(/_/g, ' ').toUpperCase() }));

  const headerRow = resolvedColumns
    .map((col) => escapeCell(col.label || col.header || col.key || ''))
    .join(',');

  const bodyRows = data.map((item, index) => {
    return resolvedColumns
      .map((col) => {
        let val;
        if (typeof col.format === 'function') {
          val = col.format(item, index);
        } else if (col.key) {
          // Supports nested keys like 'product.name' or 'client.name'
          val = col.key.split('.').reduce((acc, part) => (acc !== null && acc !== undefined ? acc[part] : undefined), item);
          // If undefined, check direct property
          if (val === undefined && item[col.key] !== undefined) {
            val = item[col.key];
          }
        } else {
          val = '';
        }
        return escapeCell(val !== undefined ? val : '');
      })
      .join(',');
  });

  // UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headerRow, ...bodyRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', finalFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return data.length;
}

