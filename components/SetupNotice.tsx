export function SetupNotice() {
  return (
    <div className="bg-pink border-b-2 border-ink px-4 py-2 text-sm font-semibold text-center">
      Supabase is not configured yet. Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and follow README → “Set up”.
    </div>
  );
}
