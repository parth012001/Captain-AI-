// React import not needed for modern JSX transform
import { Mail, Megaphone, Brain, Calendar } from 'lucide-react';
import { Badge } from '../ui';
import type { DashboardTab } from '../../types/promotionalEmail';

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  unreadPromotionalCount?: number;
}

export function DashboardTabs({ activeTab, onTabChange, unreadPromotionalCount = 0 }: DashboardTabsProps) {
  const tabs = [
    {
      id: 'active' as DashboardTab,
      label: 'Active Emails',
      icon: Mail,
      description: 'Business emails with AI-generated drafts'
    },
    {
      id: 'promotional' as DashboardTab,
      label: 'Promotional Emails',
      icon: Megaphone,
      description: 'Newsletters and marketing emails',
      badge: unreadPromotionalCount > 0 ? unreadPromotionalCount : undefined
    },
    {
      id: 'learning' as DashboardTab,
      label: 'AI Insights',
      icon: Brain,
      description: 'Learning analytics and AI performance metrics'
    },
    {
      id: 'calendar' as DashboardTab,
      label: 'Calendar',
      icon: Calendar,
      description: 'Meetings, scheduling, and calendar management'
    }
  ];

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="flex space-x-8" aria-label="Dashboard navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                group relative py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${isActive
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Icon 
                    className={`
                      h-5 w-5 transition-colors duration-200
                      ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}
                    `} 
                  />
                  <span className="text-slate-900">{tab.label}</span>
                </div>
                {tab.badge && (
                  <Badge 
                    variant="muted" 
                    className={`
                      bg-orange-100 text-orange-800 border-orange-200 text-xs px-2 py-0.5 ml-1
                      ${isActive ? 'bg-orange-200 text-orange-900' : ''}
                    `}
                  >
                    {tab.badge}
                  </Badge>
                )}
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                {tab.description}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
