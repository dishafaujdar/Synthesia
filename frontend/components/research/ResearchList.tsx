'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient, ResearchRequest } from '@/lib/api'

interface ResearchListProps {
  onSelectRequest: (id: string) => void
}

export function ResearchList({ onSelectRequest }: ResearchListProps) {
  const [requests, setRequests] = useState<ResearchRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadRequests = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.getResearchRequests(page, 10)
      setRequests(response.data || [])
      setTotalPages(response.pagination?.pages || 1)
      setError(null)
    } catch (err) {
      console.error('Failed to load research requests:', err)
      setRequests([])
      setError(err instanceof Error ? err.message : 'Failed to load research requests')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [page])

  const handleDeleteRequest = async (id: string, force = false) => {
    if (!confirm('Are you sure you want to delete this research request? This action cannot be undone.')) {
      return;
    }

    setDeletingIds(prev => new Set(prev.add(id)));
    try {
      await apiClient.deleteResearchRequest(id, force);
      // Remove from local state
      setRequests(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (err) {
      console.error('Failed to delete research request:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete research request');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} research request(s)? This action cannot be undone.`)) {
      return;
    }

    const idsArray = Array.from(selectedIds);
    setDeletingIds(prev => {
      const newSet = new Set(prev);
      idsArray.forEach(id => newSet.add(id));
      return newSet;
    });

    try {
      await apiClient.bulkDeleteResearchRequests({ ids: idsArray });
      // Remove from local state
      setRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setShowBulkActions(false);
    } catch (err) {
      console.error('Failed to bulk delete research requests:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete research requests');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        idsArray.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Poll for updates every 5 seconds for active requests
  useEffect(() => {
    const hasActiveRequests = requests.some(r => 
      r.status === 'PENDING' || r.status === 'PROCESSING'
    )

    if (!hasActiveRequests) return

    const interval = setInterval(() => {
      loadRequests()
    }, 5000)

    return () => clearInterval(interval)
  }, [requests])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'FAILED':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'CANCELLED':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (createdAt: string, completedAt?: string) => {
    const start = new Date(createdAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  if (isLoading && requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
            {error}
          </div>
          <Button onClick={loadRequests} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Research Requests
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  disabled={deletingIds.size > 0}
                >
                  Delete Selected ({selectedIds.size})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedIds(new Set());
                    setShowBulkActions(false);
                  }}
                >
                  Clear Selection
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowBulkActions(!showBulkActions)}
            >
              {showBulkActions ? 'Hide' : 'Select'}
            </Button>
            <Button variant="outline" size="sm" onClick={loadRequests}>
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No research requests yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first research request using the form on the left.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  {showBulkActions && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(request.id)}
                      onChange={() => toggleSelectRequest(request.id)}
                      className="mt-1 mr-3"
                    />
                  )}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => !showBulkActions && onSelectRequest(request.id)}
                  >
                    <h3 className="font-semibold text-sm mb-2 truncate">
                      {request.topic}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span>Created: {formatDate(request.createdAt)}</span>
                      <span>•</span>
                      <span>Duration: {formatDuration(request.createdAt, request.completedAt)}</span>
                      <span>•</span>
                      <span className="capitalize">Priority: {request.priority}</span>
                    </div>
                    {request.status === 'PROCESSING' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{request.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${request.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {request.error && (
                      <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                        <p className="text-xs text-red-600">{request.error}</p>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const needsForce = request.status === 'PROCESSING';
                        handleDeleteRequest(request.id, needsForce);
                      }}
                      disabled={deletingIds.has(request.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      {deletingIds.has(request.id) ? '...' : '×'}
                    </Button>
                  </div>
                </div>
                
                {request.results && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Articles:</span>
                        <span className="ml-1 font-medium">{request.results?.totalArticles || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Keywords:</span>
                        <span className="ml-1 font-medium">{request.results?.keywords?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="ml-1 font-medium">{request.results ? Math.round(request.results.confidence * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
