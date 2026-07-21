export function ConflictAlert({ reloadHref }: { reloadHref: string }) {
  return (
    <div className="error-summary" role="alert">
      <p>This content changed elsewhere. Reload before trying again.</p>
      <a href={reloadHref}>Reload current content</a>
    </div>
  );
}
