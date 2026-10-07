/**
 * Enterprise CSV Exporter Utility
 * Requirement 23: Download CSV of currently filtered results.
 * Respects all active filters: Search, Product, Employee, Client, Godown, Status, Date range, etc.
 * Column order standard: ID/Serial Number -> Date -> Other information.
 * Strips leading '#' from IDs and transactions.
 */

export function exportToCSV({ filename = 'export.csv', columns = [], data = [] }) {
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

  const headerRow = columns.map((col) => escapeCell(col.label || col.key || '')).join(',');

  const bodyRows = data.map((item, index) => {
    return columns
      .map((col) => {
        let val;
        if (typeof col.format === 'function') {
          val = col.format(item, index);
        } else if (col.key) {
          // Supports nested keys like 'product.name' or 'client.name'
          val = col.key.split('.').reduce((acc, part) => acc && acc[part], item);
        } else {
          val = '';
        }
        return escapeCell(val);
      })
      .join(',');
  });

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
