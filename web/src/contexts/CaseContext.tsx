import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Case, Artifact } from '../types'
import { API_PREFIX } from '../apiConfig'

interface CaseContextType {
  caseData: Case | null
  setCaseData: (data: Case) => void
  artifacts: Artifact[]
}

const CaseContext = createContext<CaseContextType | undefined>(undefined)

export function CaseProvider({ children }: { children: ReactNode }) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [artifacts, _setArtifacts] = useState<Artifact[]>([])

  return (
    <CaseContext.Provider value={{ caseData, setCaseData, artifacts }}>
      {children}
    </CaseContext.Provider>
  )
}

export function useCase() {
  const context = useContext(CaseContext)
  if (!context) {
    throw new Error('useCase must be used within a CaseProvider')
  }
  return context
}

/** Auto-load case data from API when navigating directly to a case URL */
export function useCaseLoader(explicitCaseId?: string) {
  const params = useParams<{ id?: string; caseId?: string }>()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const { caseData, setCaseData } = useCase()

  // Extract caseId from explicit arg, params, or URL path
  const pathMatch = location.pathname.match(/^\/case\/([^/]+)/)
  const caseId = explicitCaseId || params.caseId || params.id || (pathMatch ? pathMatch[1] : undefined)

  useEffect(() => {
    if (!caseId) return
    if (caseData?.id === caseId) return  // already loaded
    setLoading(true)
    fetch(`${API_PREFIX}/cases/${caseId}`)
      .then(r => r.json())
      .then(d => { if (d.id) setCaseData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId, caseData?.id, setCaseData])

  return { caseData, loading }
}
