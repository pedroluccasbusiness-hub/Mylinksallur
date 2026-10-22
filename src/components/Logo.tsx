import { Link } from 'react-router-dom'
import { BRAND } from './PublicPageView'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-baseline gap-1.5 text-bone" aria-label={`${BRAND}, início`}>
      <span className="font-display text-[1.6rem] font-semibold italic leading-none tracking-tight">{BRAND}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-orchid" />
    </Link>
  )
}
