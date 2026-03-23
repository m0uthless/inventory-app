import * as React from 'react'
import { Box } from '@mui/material'
import WeatherHeroCard from '../ui/WeatherHeroCard'
import ContributorCard from '../ui/ContributorCard'
import RecentIssuesCard from '../ui/RecentIssuesCard'
import AnnouncementsCard from '../ui/AnnouncementsCard'
import TodoCard from '../ui/TodoCard'
import MaintenanceAlertsCard from '../ui/MaintenanceAlertsCard'

// ─── Widget carousel (mobile) ─────────────────────────────────────────────────

const WIDGETS = [
  <RecentIssuesCard key="issues" />,
  <MaintenanceAlertsCard key="maintenance" />,
  <AnnouncementsCard key="announcements" />,
  <TodoCard key="todo" />,
]
const TOTAL = WIDGETS.length

function WidgetCarousel() {
  const [index, setIndex] = React.useState(0)
  const touchStartX = React.useRef<number | null>(null)

  const prev = () => setIndex(i => (i - 1 + TOTAL) % TOTAL)
  const next = () => setIndex(i => (i + 1) % TOTAL)

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  return (
    <>
      <Box
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        sx={{ overflow: 'hidden', borderRadius: 1 }}
      >
        {WIDGETS[index]}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 1.25 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <Box
            key={i}
            onClick={() => setIndex(i)}
            sx={{
              width: i === index ? 18 : 7,
              height: 7,
              borderRadius: '999px',
              bgcolor: i === index ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>
    </>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>

      {/* Riga 1: Weather hero + Contributor */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 350px' },
        gap: 2,
        alignItems: 'stretch',
      }}>
        <WeatherHeroCard />
        <ContributorCard />
      </Box>

      {/* Riga 2: desktop = griglia 2 colonne, mobile = carousel swipe */}
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'stretch' }}>
        <RecentIssuesCard />
        <MaintenanceAlertsCard />
      </Box>

      {/* Riga 3: desktop = griglia 2 colonne */}
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'stretch' }}>
        <AnnouncementsCard />
        <TodoCard />
      </Box>

      {/* Mobile: carousel swipe */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <WidgetCarousel />
      </Box>

    </Box>
  )
}
