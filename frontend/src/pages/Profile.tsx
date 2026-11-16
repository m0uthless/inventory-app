import { useNavigate } from 'react-router-dom'
import ProfileCard from '../features/profile/ProfileCard'

/** /profile: apre la scheda del profilo; chiudendola si torna dove si era. */
export default function Profile() {
  const navigate = useNavigate()
  return <ProfileCard onClose={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }} />
}

/** Profilo aperto dal menu utente nella barra in alto. */
export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <ProfileCard onClose={onClose} /> : null
}
