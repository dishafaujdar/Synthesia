'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient, ResearchRequest, TaskLog } from '@/lib/api'

interface ResearchDetailsProps {
  requestId: string
  onClose: () => void
}

export function ResearchDetails({ requestId, onClose }: ResearchDetailsProps) {
  const [request, setRequest] = useState<ResearchRequest | null>(null)
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'articles' | 'logs'>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRequest = async () => {
    try {
      const data = await apiClient.getResearchRequest(requestId)
      setRequest(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request details')
    }
  }

  const loadLogs = async () => {
    try {
      const data = await apiClient.getResearchLogs(requestId)
      setLogs(data)
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    await Promise.all([loadRequest(), loadLogs()])
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [requestId])

  // Poll for updates if request is active
  useEffect(() => {
    if (!request || (request.status !== 'PENDING' && request.status !== 'PROCESSING')) {
      return
    }

    const interval = setInterval(() => {
      loadData()
    }, 3000)

    return () => clearInterval(interval)
  }, [request?.status])

  const handleCancel = async () => {
    if (!request || request.status === 'COMPLETED' || request.status === 'FAILED') return
    
    try {
      await apiClient.cancelResearchRequest(requestId)
      await loadRequest()
    } catch (err) {
      console.error('Failed to cancel request:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600'
      case 'WARN':
        return 'text-yellow-600'
      case 'INFO':
        return 'text-blue-600'
      case 'DEBUG':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Request Details
            <Button variant="outline" size="sm" onClick={onClose}>
              ← Back
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !request) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Request Details
            <Button variant="outline" size="sm" onClick={onClose}>
              ← Back
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
            {error || 'Request not found'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold truncate">{request.topic}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                request.status === 'COMPLETED' ? 'text-green-600 bg-green-50 border-green-200' :
                request.status === 'PROCESSING' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                request.status === 'PENDING' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                request.status === 'FAILED' ? 'text-red-600 bg-red-50 border-red-200' :
                'text-gray-600 bg-gray-50 border-gray-200'
              }`}>
                {request.status}
              </span>
              <span className="text-sm text-muted-foreground">
                {request.progress}% complete
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(request.status === 'PENDING' || request.status === 'PROCESSING') && (
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              ← Back
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar for active requests */}
        {request.status === 'PROCESSING' && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Processing Progress</span>
              <span>{request.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${request.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Navigation tabs */}
        <div className="border-b mb-6">
          <nav className="flex space-x-8">
            {(['overview', 'articles', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'articles' && request.results && (
                  <span className="ml-1 text-xs">({request.results?.totalArticles || 0})</span>
                )}
                {tab === 'logs' && (
                  <span className="ml-1 text-xs">({logs.length})</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Created</h4>
                <p className="text-sm text-muted-foreground">{formatDate(request.createdAt)}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Priority</h4>
                <p className="text-sm text-muted-foreground capitalize">{request.priority}</p>
              </div>
              {request.completedAt && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Completed</h4>
                  <p className="text-sm text-muted-foreground">{formatDate(request.completedAt)}</p>
                </div>
              )}
              <div>
                <h4 className="font-medium text-sm mb-2">Correlation ID</h4>
                <p className="text-sm text-muted-foreground font-mono">{request.correlationId}</p>
              </div>
            </div>

            {request.error && (
              <div className="p-4 rounded-md bg-red-50 border border-red-200">
                <h4 className="font-medium text-sm text-red-800 mb-2">Error</h4>
                <p className="text-sm text-red-600">{request.error}</p>
              </div>
            )}

            {request.results && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {request.results?.summary || 'No summary available'}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {request.results?.keyInsights && Array.isArray(request.results.keyInsights) 
                      ? request.results.keyInsights.map((insight, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 mr-2 flex-shrink-0" />
                            {insight}
                          </li>
                        ))
                      : (
                          <li className="text-sm text-muted-foreground">No insights available</li>
                        )
                    }
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {request.results?.keywords && Array.isArray(request.results.keywords)
                      ? request.results.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                          >
                            {keyword}
                          </span>
                        ))
                      : (
                          <span className="text-sm text-muted-foreground">No keywords available</span>
                        )
                    }
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{request.results?.totalArticles || 0}</div>
                    <div className="text-xs text-muted-foreground">Articles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{request.results?.confidence ? Math.round(request.results.confidence * 100) : 0}%</div>
                    <div className="text-xs text-muted-foreground">Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{request.results?.processingTime ? Math.round(request.results.processingTime / 1000) : 0}s</div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'articles' && request.results && (
          <div className="space-y-4">
            {request.results.articles && Array.isArray(request.results.articles)
              ? request.results.articles.map((article, index) => (
              <div key={article.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{article.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="bg-secondary px-2 py-1 rounded">{article.source}</span>
                    <span>Score: {article.relevanceScore.toFixed(1)}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{article.summary}</p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Read full article →
                </a>
              </div>
            ))
              : (
                <p className="text-sm text-muted-foreground text-center py-8">No articles available</p>
              )
            }
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No logs available</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <span className={`text-xs font-mono font-medium ${getLogLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{log.step}</span>
                      <span>•</span>
                      <span>{formatDate(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
