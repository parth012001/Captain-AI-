// React import not needed for modern JSX transform
import { useState } from 'react';
import { StatusBar } from './layout/StatusBar';
import { EmailPanel } from './email/EmailPanel';
import { DraftPanel } from './draft/DraftPanel';
import { PromotionalEmailsPanel } from './email/PromotionalEmailsPanel';
import { LearningPanel } from './learning/LearningPanel';
import { CalendarPanel } from './calendar/CalendarPanel';
import { DashboardTabs } from './navigation/DashboardTabs';
import { Toast } from './ui/Toast';
import { ProfileButton } from './ui/ProfileButton';
import { useToast } from '../hooks/useToast';
import { useUnreadPromotionalEmailCount } from '../hooks/usePromotionalEmails';
import type { DashboardTab } from '../types/promotionalEmail';

export default function Dashboard() {
  const { toasts } = useToast();
  const [activeTab, setActiveTab] = useState<DashboardTab>('active');
  const { unreadCount } = useUnreadPromotionalEmailCount();

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
        
        {/* Tab Navigation */}
        <DashboardTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          unreadPromotionalCount={unreadCount}
        />
        
        {/* Content based on active tab */}
        {activeTab === 'active' ? (
          /* Two-Panel Layout for Active Emails */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-16rem)]">
            {/* Left Panel - Latest Email */}
            <div className="flex flex-col">
              <EmailPanel />
            </div>
            
            {/* Right Panel - AI Draft */}
            <div className="flex flex-col">
              <DraftPanel />
            </div>
          </div>
        ) : activeTab === 'promotional' ? (
          /* Single Panel Layout for Promotional Emails */
          <div className="h-[calc(100vh-16rem)]">
            <PromotionalEmailsPanel />
          </div>
        ) : activeTab === 'learning' ? (
          /* Single Panel Layout for AI Learning */
          <div className="h-[calc(100vh-16rem)] overflow-y-auto">
            <LearningPanel />
          </div>
        ) : (
          /* Single Panel Layout for Calendar */
          <div className="h-[calc(100vh-16rem)]">
            <CalendarPanel />
          </div>
        )}
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