import React from 'react';
import Button from './Button';

export default function Pagination({
  currentPage = 1,
  lastPage,
  totalPages,
  total,
  totalItems,
  perPage = 15,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 25, 50, 100],
}) {
  const finalLastPage = Math.max(1, Number(lastPage ?? totalPages ?? 1));
  const finalTotal = Number(total ?? totalItems ?? 0);

  // If there are no items at all, don't display
  if (finalTotal === 0 && finalLastPage <= 1) return null;

  const startItem = finalTotal === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, finalTotal);

  // Helper to generate pagination page array with ellipsis
  const getPageNumbers = () => {
    if (finalLastPage <= 7) {
      return Array.from({ length: finalLastPage }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', finalLastPage];
    }
    if (currentPage >= finalLastPage - 3) {
      return [1, '...', finalLastPage - 4, finalLastPage - 3, finalLastPage - 2, finalLastPage - 1, finalLastPage];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', finalLastPage];
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 sm:px-6 rounded-b-xl">
      {/* Left side: Range info & Per-page selector */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <div>
          Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900">{finalTotal}</span> entries
        </div>

        {onPerPageChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="py-1 px-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="!py-1 !px-2.5 text-xs"
        >
          Previous
        </Button>

        {/* Page number buttons */}
        <div className="hidden md:flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-slate-400 select-none">
                  ...
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 text-xs font-medium rounded-lg transition-colors flex items-center justify-center ${
                  isActive
                    ? 'bg-primary-600 text-white font-semibold shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Mobile current page indicator */}
        <div className="flex md:hidden items-center px-2 text-xs font-medium text-slate-700">
          Page {currentPage} of {finalLastPage}
        </div>

        <Button
          size="sm"
          variant="secondary"
          disabled={currentPage >= finalLastPage}
          onClick={() => onPageChange(currentPage + 1)}
          className="!py-1 !px-2.5 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
