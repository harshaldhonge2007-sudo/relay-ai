import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Case, Artifact } from '../types'
import { apiFetch } from '../api'
import { RelayRole, setApiRole } from '../api'

// Re-export for convenience
export type { RelayRole }

interface RoleContextType {
  role: RelayRole
  setRole: (r: RelayRole) => void
}

const RoleContext = createContext<RoleContextType>({
  role: 'successor',
  setRole: () => {},
})

interface CaseContextType {
  caseData: Case | null
  setCaseData: (data: Case) => void
  artifacts: Artifact[]
}

const CaseContext = createContext<CaseContextType | undefined>(undefined)

export function CaseProvider({ children }: { children: ReactNode }) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [artifacts, _setArtifacts] = useState<Artifact[]>([])
  const [role, setRoleState] = useState<RelayRole>('successor')

  function setRole(r: RelayRole) {
    setApiRole(r)
    setRoleState(r)
  }

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <CaseContext.Provider value={{ caseData, setCaseData, artifacts }}>
        {children}
      </CaseContext.Provider>
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
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

  const pathMatch = location.pathname.match(/^\/case\/([^/]+)/)
  const caseId = explicitCaseId || params.caseId || params.id || (pathMatch ? pathMatch[1] : undefined)

  useEffect(() => {
    if (!caseId) return
    if (caseData?.id === caseId) return
    setLoading(true)
    apiFetch(`/cases/${caseId}`)
      .then(r => r.json())
      .then(d => { if (d.id) setCaseData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId, caseData?.id, setCaseData])

  return { caseData, loading }
}
