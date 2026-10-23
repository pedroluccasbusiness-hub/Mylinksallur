import { Link } from 'react-router-dom'
import { BRAND } from './PublicPageView'

/** Símbolo: dois elos de link abertos e desencaixados (o mesmo do ícone do app). */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="96 96 320 320" aria-hidden className="shrink-0">
      <g transform="rotate(-45 256 256) translate(0 -16)" fill="none" strokeLinecap="round" strokeWidth="44">
        <path d="M296 200 H164 A56 56 0 0 0 164 312 H230" stroke="#E7C9A1" />
        <path d="M216 232 H348 A56 56 0 0 1 348 344 H282" stroke="#B98AFF" />
      </g>
    </svg>
  )
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-bone" aria-label={`${BRAND}, início`}>
      <LogoMark />
      <span className="whitespace-nowrap font-display text-[1.3rem] font-semibold italic leading-none tracking-tight sm:text-[1.6rem]">
        {BRAND}
      </span>
    </Link>
  )
}
