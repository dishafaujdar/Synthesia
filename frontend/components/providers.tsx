'use client'

import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div id="toast-container" className="fixed top-4 right-4 z-50" />
    </>
  )
}
