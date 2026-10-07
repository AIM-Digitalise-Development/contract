import React, { forwardRef } from 'react';

const Select = forwardRef(function Select(
  {
    label,
    name,
    id,
    options = [],
    placeholder = 'Select an option',
    error,
    helperText,
    required = false,
    className = '',
    containerClassName = '',
    children,
    ...props
  },
  ref
) {
  const selectId = id || name;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        name={name}
        required={required}
        className={`w-full rounded-lg border px-3.5 py-2 text-sm text-slate-900 bg-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-slate-200 hover:border-slate-300'
        } ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children ||
          options.map((opt) => (
            <option
              key={opt.value ?? opt.id}
              value={opt.value ?? opt.id}
              disabled={opt.disabled}
            >
              {opt.label ?? opt.name}
            </option>
          ))}
      </select>
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
});

export default Select;
