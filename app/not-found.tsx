import './(store)/dnd.css';

// Root 404: rendered outside the store layout, so it brings the store's stylesheet with it.
export default function NotFound() {
  return (
    <div className="app">
      <div className="page-width section">
        <div className="empty">
          <span>🚪</span>
          <h3>Do not disturb.</h3>
          <p className="muted">This page is fast asleep, or it never existed.</p>
          <a className="btn btn-dark" href="/">Back to the store</a>
        </div>
      </div>
    </div>
  );
}
