'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { apiClient, CreateResearchRequest } from '@/lib/api'

interface ResearchFormProps {
  onRequestCreated: () => void
}

export function ResearchForm({ onRequestCreated }: ResearchFormProps) {
  const [topic, setTopic] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!topic.trim()) {
      setError('Please enter a research topic')
      return
    }

    if (topic.trim().length < 5) {
      setError('Topic must be at least 5 characters long')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const request: CreateResearchRequest = {
        topic: topic.trim(),
        priority,
      }

      await apiClient.createResearchRequest(request)
      
      // Reset form
      setTopic('')
      setPriority('normal')
      
      // Notify parent
      onRequestCreated()
      
      // Show success message
      showToast('Research request created successfully!', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create research request')
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div')
    toast.className = `fixed top-4 right-4 z-50 rounded-md p-4 text-white shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`
    toast.textContent = message
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.remove()
    }, 4000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Research Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium mb-2">
              Research Topic
            </label>
            <Input
              id="topic"
              type="text"
              placeholder="Enter your research topic (e.g., 'artificial intelligence trends 2024')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isLoading}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium mb-2">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
              disabled={isLoading}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="w-full"
          >
            {isLoading ? 'Creating Request...' : 'Start Research'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
