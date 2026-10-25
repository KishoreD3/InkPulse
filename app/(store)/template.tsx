// Re-mounts on every navigation so each page gets the design's gentle enter animation.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
