export function EmptyState({ title, text, children }) {
  return (
    <div class="empty-state">
      <h2 class="empty-state-title">{title}</h2>
      <p class="empty-state-text">{text}</p>
      {children}
    </div>
  );
}
