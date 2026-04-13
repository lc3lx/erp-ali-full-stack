import { useEffect, useMemo, useRef, useState } from "react";

function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function SearchableDropdown({
  name,
  value,
  onChange,
  options,
  getOptionValue = (option) => option?.id,
  getOptionLabel = (option) => option?.name,
  placeholder = "اختر...",
  searchPlaceholder = "ابحث...",
  emptyText = "لا توجد نتائج",
  clearLabel = "— بدون اختيار —",
  disabled = false,
  allowClear = true,
  dir = "rtl",
  className = "",
  inputClassName = "",
  onSearchChange,
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    const current = options.find((option) => String(getOptionValue(option)) === String(value ?? ""));
    return current ? String(getOptionLabel(current)) : "";
  }, [getOptionLabel, getOptionValue, options, value]);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return options;
    return options.filter((option) => normalizeText(getOptionLabel(option)).includes(q));
  }, [getOptionLabel, options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const selectValue = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className={`searchable-dropdown ${className}`.trim()} ref={rootRef} dir={dir}>
      {name ? <input type="hidden" name={name} value={value ?? ""} readOnly /> : null}
      <button
        type="button"
        className={`searchable-dropdown-trigger ${inputClassName}`.trim()}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          if (!open) {
            setQuery("");
            onSearchChange?.("");
          }
        }}
      >
        <span className={selectedLabel ? "" : "is-placeholder"}>{selectedLabel || placeholder}</span>
        <span className="searchable-dropdown-caret">▾</span>
      </button>

      {open ? (
        <div className="searchable-dropdown-panel">
          <input
            ref={searchRef}
            type="text"
            className="searchable-dropdown-search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              onSearchChange?.(next);
            }}
          />
          <div className="searchable-dropdown-list">
            {allowClear ? (
              <button
                type="button"
                className="searchable-dropdown-option clear"
                onClick={() => selectValue("")}
              >
                {clearLabel}
              </button>
            ) : null}
            {filteredOptions.length === 0 ? (
              <div className="searchable-dropdown-empty">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => {
                const optionValue = String(getOptionValue(option));
                const isSelected = optionValue === String(value ?? "");
                return (
                  <button
                    key={optionValue}
                    type="button"
                    className={`searchable-dropdown-option${isSelected ? " selected" : ""}`}
                    onClick={() => selectValue(optionValue)}
                  >
                    {getOptionLabel(option)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

