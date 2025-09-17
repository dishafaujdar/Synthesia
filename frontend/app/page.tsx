'use client'

import { useState } from 'react'
import { ResearchForm } from '@/components/research/ResearchForm'
import { ResearchList } from '@/components/research/ResearchList'
import { ResearchDetails } from '@/components/research/ResearchDetails'

export default function HomePage() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [refreshList, setRefreshList] = useState(0)

  const handleRequestCreated = () => {
    setRefreshList(prev => prev + 1)
  }

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id)
  }

  const handleCloseDetails = () => {
    setSelectedRequestId(null)
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          AI Research Agent
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Enterprise-grade AI research platform with advanced async processing, 
          real-time updates, and production-ready architecture.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ResearchForm onRequestCreated={handleRequestCreated} />
        </div>
        
        <div className="lg:col-span-2">
          {selectedRequestId ? (
            <ResearchDetails 
              requestId={selectedRequestId} 
              onClose={handleCloseDetails}
            />
          ) : (
            <ResearchList 
              key={refreshList}
              onSelectRequest={handleSelectRequest}
            />
          )}
        </div>
      </div>
    </div>
  )
}
