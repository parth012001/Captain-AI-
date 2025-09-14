import { useState } from 'react';
import { Card, CardHeader, CardContent, Badge, Spinner, Button } from '../ui';
import { Megaphone, Filter, Search, X } from 'lucide-react';
import { usePromotionalEmails, useUnreadPromotionalEmailCount } from '../../hooks/usePromotionalEmails';
import { PromotionalEmailCard } from './PromotionalEmailCard';
import type { PromotionalEmailFilters } from '../../types/promotionalEmail';

export function PromotionalEmailsPanel() {
  const [filters, setFilters] = useState<PromotionalEmailFilters>({
    limit: 20,
    offset: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data, isLoading, error } = usePromotionalEmails(filters);
  const { unreadCount, totalCount } = useUnreadPromotionalEmailCount();


  const handleFilterChange = (key: keyof PromotionalEmailFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset to first page when filters change
    }));
  };

  const clearFilters = () => {
    setFilters({ limit: 20, offset: 0 });
    setSearchTerm('');
    setShowFilters(false);
  };

  const applySearch = () => {
    handleFilterChange('from_email', searchTerm);
  };

  const getFilterSummary = () => {
    const activeFilters = [];
    if (filters.is_read !== undefined) {
      activeFilters.push(filters.is_read ? 'Read only' : 'Unread only');
    }
    if (filters.classification_reason) {
      activeFilters.push(`${filters.classification_reason} emails`);
    }
    if (filters.from_email) {
      activeFilters.push(`from "${filters.from_email}"`);
    }
    return activeFilters.length > 0 ? activeFilters.join(', ') : 'All emails';
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Megaphone className="h-5 w-5 text-orange-600" />
            <h2 className="text-xl font-semibold text-slate-900">Promotional Emails</h2>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-3">
            <Spinner size="lg" />
            <p className="text-slate-500">Loading promotional emails...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Megaphone className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-semibold text-slate-900">Promotional Emails</h2>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">📧</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Failed to load promotional emails
            </h3>
            <p className="text-slate-500 mb-4">
              Could not connect to promotional email service
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const emails = data?.emails || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Megaphone className="h-5 w-5 text-orange-600" />
              <h2 className="text-xl font-semibold text-slate-900">Promotional Emails</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="muted" className="bg-orange-100 text-orange-800 border-orange-200">
                {totalCount}
              </Badge>
              {unreadCount > 0 && (
                <Badge variant="muted" className="bg-orange-200 text-orange-900 border-orange-300">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-orange-50 border-orange-200' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Filter Summary */}
        {getFilterSummary() !== 'All emails' && (
          <div className="mt-2 text-sm text-slate-700">
            Showing: <span className="font-medium text-slate-900">{getFilterSummary()}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-2 text-orange-600 hover:text-orange-700"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Read Status Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Read Status
                </label>
                <select
                  value={filters.is_read === undefined ? '' : filters.is_read.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange('is_read', value === '' ? undefined : value === 'true');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 bg-white"
                >
                  <option value="">All emails</option>
                  <option value="false">Unread only</option>
                  <option value="true">Read only</option>
                </select>
              </div>

              {/* Classification Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Type
                </label>
                <select
                  value={filters.classification_reason || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange('classification_reason', value || undefined);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 bg-white"
                >
                  <option value="">All types</option>
                  <option value="newsletter">📰 Newsletter</option>
                  <option value="marketing">📢 Marketing</option>
                  <option value="promotional">🎯 Promotional</option>
                </select>
              </div>

              {/* Search Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Search Sender
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter sender email..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 placeholder-slate-500 bg-white"
                    onKeyPress={(e) => e.key === 'Enter' && applySearch()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={applySearch}
                    className="px-3"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        {emails.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {getFilterSummary() !== 'All emails' ? 'No emails match your filters' : 'No promotional emails'}
              </h3>
              <p className="text-slate-500 mb-4">
                {getFilterSummary() !== 'All emails' 
                  ? 'Try adjusting your filters to see more emails'
                  : 'Promotional emails will appear here when received'
                }
              </p>
              {getFilterSummary() !== 'All emails' && (
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto pr-2">
            {emails.map((email) => (
              <PromotionalEmailCard key={email.id} email={email} />
            ))}
            
            {/* Load More Button */}
            {emails.length >= (filters.limit || 20) && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleFilterChange('offset', (filters.offset || 0) + (filters.limit || 20))}
                  disabled={isLoading}
                >
                  {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
