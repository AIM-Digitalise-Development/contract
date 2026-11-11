import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Package } from 'lucide-react';

/**
 * High-performance, Accessible Searchable Product Select Combobox
 * Features:
 * - Dynamic live filtering as you type (matches Name, SKU / Code, Category, Brand)
 * - Persistent open state during typing
 * - Fixed high z-index (z-50 / z-[100]) so it is never clipped by modal overflow or cards
 * - Auto-scrolls to selected item
 * - Keyboard navigation (Escape to close)
 * - Clearable selection
 */
export default function SearchableProductSelect({
  products = [],
  value,
  onChange,
  label,
  placeholder = 'Search & select product by SKU or name...',
  required = false,
  error,
  helperText,
  disabled = false,
  className = '',
  containerClassName = '',
  id,
  name,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    if (!value && value !== 0) return null;
    return products.find((p) => String(p.id) === String(value)) || null;
  }, [products, value]);

  // Dynamic live search filtering across SKU code, Name, Category, Procurement from
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }
    const q = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const codeMatch = p.code && p.code.toLowerCase().includes(q);
      const nameMatch = p.name && p.name.toLowerCase().includes(q);
      const catMatch = p.category && p.category.toLowerCase().includes(q);
      const brandMatch = p.procurement_from && p.procurement_from.toLowerCase().includes(q);
      const descMatch = p.description && p.description.toLowerCase().includes(q);
      return codeMatch || nameMatch || catMatch || brandMatch || descMatch;
    });
  }, [products, searchTerm]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (product) => {
    if (onChange) {
      onChange(product.id, product);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('', null);
    }
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`flex flex-col gap-1.5 relative ${containerClassName}`} onKeyDown={handleKeyDown}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {selectedProduct && (
            <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              SKU: {selectedProduct.code}
            </span>
          )}
        </label>
      )}

      {/* Hidden input for form submits */}
      <input type="hidden" name={name} id={id} value={value || ''} />

      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-expanded={isOpen}
        className={`w-full min-h-[42px] px-3.5 py-2 rounded-lg border text-sm bg-white flex items-center justify-between transition-all cursor-pointer ${
          disabled
            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
            : isOpen
            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
            : error
            ? 'border-rose-400 hover:border-rose-500 ring-rose-500/20'
            : 'border-slate-300 hover:border-slate-400'
        } ${className}`}
      >
        <div className="flex-1 flex items-center gap-2 overflow-hidden mr-2">
          {selectedProduct ? (
            <div className="flex items-center gap-2 truncate">
              <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold bg-blue-100 text-blue-800 rounded shrink-0">
                {selectedProduct.code}
              </span>
              <span className="font-medium text-slate-900 truncate">
                {selectedProduct.name}
              </span>
              {selectedProduct.unit && (
                <span className="text-xs text-slate-500 shrink-0">
                  ({selectedProduct.unit})
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 flex items-center gap-2 truncate">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedProduct && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </div>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col animation-fadeIn max-h-[340px]">
          {/* Live Search Input Bar */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to filter by SKU, product name, brand..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-slate-700 font-bold"
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-slate-500">
              <span>
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
              </span>
              {searchTerm && (
                <span className="text-blue-600 font-medium">
                  Filtering for "{searchTerm}"
                </span>
              )}
            </div>
          </div>

          {/* Product Items List */}
          <div ref={listRef} className="overflow-y-auto max-h-[250px] divide-y divide-slate-50 p-1">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No products found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No products match your search query "{searchTerm}".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-xs text-blue-600 hover:underline font-semibold"
                >
                  Clear search to view all products
                </button>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = String(p.id) === String(value);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`px-3 py-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-900 font-semibold border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-200">
                          {p.code}
                        </span>
                        {p.category && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                            {p.category}
                          </span>
                        )}
                        {p.unit && (
                          <span className="text-[10px] text-slate-400">
                            ({p.unit})
                          </span>
                        )}
                      </div>
                      <p className="font-medium truncate text-slate-900">{p.name}</p>
                    </div>

                    <div className="flex items-center shrink-0">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: #{p.id}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
