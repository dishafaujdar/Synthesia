export interface ResearchRequest {
  id: string
  topic: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  priority: string
  progress: number
  correlationId: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
  results?: ResearchResult[] // Changed from single object to array
}

export interface ResearchResult {
  id: string
  summary: string
  keyInsights: string[]
  keywords: string[]
  totalArticles: number
  processingTime: number
  confidence: number
  articles: Article[]
}

export interface Article {
  id: string
  title: string
  url: string
  summary: string
  source: string
  relevanceScore: number
  publishedAt?: string
}

export interface CreateResearchRequest {
  topic: string
  priority?: 'low' | 'normal' | 'high'
}

export interface TaskLog {
  id: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  step: string
  timestamp: string
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error?.message || error.message || 'Request failed')
    }

    return response.json()
  }

  async createResearchRequest(data: CreateResearchRequest): Promise<ResearchRequest> {
    return this.request<ResearchRequest>('/api/research', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getResearchRequests(page = 1, limit = 10): Promise<{
    data: ResearchRequest[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }> {
    return this.request(`/api/research?page=${page}&limit=${limit}`)
  }

  async getResearchRequest(id: string): Promise<ResearchRequest> {
    return this.request<ResearchRequest>(`/api/research/${id}`)
  }

  async getResearchStatus(id: string): Promise<{
    id: string
    status: string
    progress: number
    error?: string
    updatedAt: string
  }> {
    return this.request(`/api/research/${id}/status`)
  }

  async getResearchLogs(id: string): Promise<TaskLog[]> {
    return this.request<TaskLog[]>(`/api/research/${id}/logs`)
  }

  async cancelResearchRequest(id: string): Promise<{ message: string }> {
    return this.request(`/api/research/${id}`, {
      method: 'DELETE',
    })
  }

  async deleteResearchRequest(id: string, force = false): Promise<{ message: string }> {
    const url = force ? `/api/research/${id}?force=true` : `/api/research/${id}`;
    return this.request(url, {
      method: 'DELETE',
    })
  }

  async bulkDeleteResearchRequests(data: {
    ids?: string[]
    status?: string
    olderThan?: string
  }): Promise<{ message: string; deletedCount: number }> {
    return this.request('/api/research', {
      method: 'DELETE',
      body: JSON.stringify(data),
    })
  }
}

export const apiClient = new ApiClient()
