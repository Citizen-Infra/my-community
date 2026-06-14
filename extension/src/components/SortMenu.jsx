import { useState, useRef, useEffect } from 'preact/hooks';

export function SortMenu({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div class="sort-wrapper" ref={menuRef}>
      <button
        class={`sort-btn ${value !== 'manual' ? 'sort-active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        title="Sort"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M3 12h12M3 18h6" />
        </svg>
      </button>
      {open && (
        <div class="sort-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              class={`sort-menu-item ${opt.value === value ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span class="sort-menu-check">{opt.value === value ? '\u2713' : ''}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
