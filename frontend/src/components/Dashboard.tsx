// React import not needed for modern JSX transform
import { StatusBar } from './layout/StatusBar';
import { EmailPanel } from './email/EmailPanel';
import { DraftPanel } from './draft/DraftPanel';
import { Toast } from './ui/Toast';
import { ProfileButton } from './ui/ProfileButton';
import { useToast } from '../hooks/useToast';

export default function Dashboard() {
  const { toasts } = useToast();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Status Bar */}
      <StatusBar />
      
      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Chief AI Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Monitor your automated email assistant and manage AI-generated responses
            </p>
          </div>
          <ProfileButton />
        </div>
        
        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel - Latest Email */}
          <div className="flex flex-col">
            <EmailPanel />
          </div>
          
          {/* Right Panel - AI Draft */}
          <div className="flex flex-col">
            <DraftPanel />
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </div>
  );
}