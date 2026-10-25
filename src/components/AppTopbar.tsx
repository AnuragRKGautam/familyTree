import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AppTopbarProps {
  title?: string
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * Site header with a collapsible nav menu on narrow screens.
 */
export function AppTopbar({ title = 'Family Tree', subtitle, children }: AppTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    function onResize() {
      if (window.matchMedia('(min-width: 901px)').matches) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Link to="/tree" className="topbar-title">
          {title}
        </Link>
        {subtitle ? <span className="muted topbar-subtitle">{subtitle}</span> : null}
      </div>
      <button
        type="button"
        className="topbar-menu-toggle"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? 'Close' : 'Menu'}
      </button>
      <nav
        id={menuId}
        className={`topbar-nav${menuOpen ? ' topbar-nav--open' : ''}`}
        onClick={() => setMenuOpen(false)}
      >
        {children}
      </nav>
    </header>
  )
}
