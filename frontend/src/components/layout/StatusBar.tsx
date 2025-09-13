// React import not needed for modern JSX transform
import { useLatestEmail } from '../../hooks/useEmails';
import { useLatestDraft } from '../../hooks/useDrafts';

export function StatusBar() {
  const { isLoading: emailLoading } = useLatestEmail();
  const { isLoading: draftLoading } = useLatestDraft();

  const systemStatus = emailLoading || draftLoading ? 'loading' : 'active';

  return (
    <div className="flex items-center bg-white border-b border-slate-200 px-6 py-3">
      {/* System Status - Centered */}
      <div className="flex items-center space-x-2">
        {systemStatus === 'loading' ? (
          <>
            <div className="h-3 w-3 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-amber-600">Processing...</span>
          </>
        ) : (
          <>
            <div className="h-3 w-3 bg-emerald-500 rounded-full" />
            <span className="text-sm font-medium text-emerald-600">Live</span>
          </>
        )}
      </div>
    </div>
  );
}