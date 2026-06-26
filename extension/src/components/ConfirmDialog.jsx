import { useEffect, useRef } from 'preact/hooks';

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div class="modal-overlay" onClick={onCancel}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h2 class="modal-title">{title}</h2>
        <p class="modal-text">{message}</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            class={`modal-btn ${danger ? 'danger' : 'confirm'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
