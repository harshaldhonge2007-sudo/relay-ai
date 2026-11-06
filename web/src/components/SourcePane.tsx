import { useState, useEffect } from 'react'
import { useCase } from '../contexts/CaseContext'
import { Artifact } from '../types'

interface SourcePaneProps {
  artifactId?: string
}

export function SourcePane({ artifactId }: SourcePaneProps) {
  const { caseData } = useCase()
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)

  useEffect(() => {
    if (artifactId && caseData?.artifacts) {
      const artifact = caseData.artifacts.find(a => a.id === artifactId)
      if (artifact) setSelectedArtifact(artifact)
    }
  }, [artifactId, caseData])

  if (!selectedArtifact) {
    return (
      <div className="w-96 border-l border-gray-300 bg-white p-4 text-center text-gray-500">
        Select an artifact to view source
      </div>
    )
  }

  return (
    <div className="w-96 border-l border-gray-300 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-300">
        <h3 className="font-semibold text-ink">{selectedArtifact.title}</h3>
        <p className="text-sm text-gray-500">
          {selectedArtifact.source} • {selectedArtifact.type}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        <pre className="whitespace-pre-wrap">{selectedArtifact.body}</pre>
      </div>
    </div>
  )
}
