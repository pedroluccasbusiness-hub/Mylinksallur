import { Link } from 'react-router-dom'
import { BRAND } from './PublicPageView'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-baseline gap-1.5 text-bone" aria-label={`${BRAND}, início`}>
      <span className="whitespace-nowrap font-display text-[1.3rem] font-semibold italic leading-none tracking-tight sm:text-[1.6rem]">{BRAND}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-orchid" />
    </Link>
  )
}
