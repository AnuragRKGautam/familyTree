import { Link, useNavigate, useParams } from 'react-router-dom'
import { PersonProfile } from './PersonProfile'
import { StatusMessage } from './StatusMessage'

export function PersonProfilePage() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()

  if (!personId) {
    return <StatusMessage variant="empty" title="Person not found" />
  }

  return (
    <main className="page-panel">
      <p>
        <Link to={`/tree/${personId}`}>← Back to tree</Link>
      </p>
      <PersonProfile
        personId={personId}
        onFocus={(id) => {
          navigate(`/tree/${id}`)
        }}
      />
    </main>
  )
}
