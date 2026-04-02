import { useEffect, useMemo, useState } from 'react'
import '../../App.css'
import { NotificationsDropdown } from '../../components/erp/NotificationsDropdown.jsx'
import { ALL_PAGE_IDS, NAV_GROUPS, STORE_KEEPER_HIDDEN } from '../../appNavConfig.js'

export function AppShell({ user, logout, page, setPage, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navGroups = useMemo(() => {
    if (user?.role === 'STORE_KEEPER') {
      return NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !STORE_KEEPER_HIDDEN.has(i.id)),
      })).filter((g) => g.items.length > 0)
    }
    return NAV_GROUPS
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'STORE_KEEPER') return
    if (STORE_KEEPER_HIDDEN.has(page)) setPage('hub')
  }, [user?.role, page, setPage])

  useEffect(() => {
    const onSetPage = (e) => {
      const p = e.detail?.page
      if (typeof p === 'string' && ALL_PAGE_IDS.includes(p)) setPage(p)
    }
    window.addEventListener('app:set-page', onSetPage)
    return () => window.removeEventListener('app:set-page', onSetPage)
  }, [setPage])

  return (
    <div className="app-shell app-shell--erp" dir="rtl">
      <header className="erp-topbar">
        <button type="button" className="app-sidebar-toggle erp-topbar-toggle" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </button>
        <div className="erp-topbar-title">منصة الحاويات والمحاسبة</div>
        <div className="erp-topbar-spacer" />
        {user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT' || user?.role === 'DATA_ENTRY' ? (
          <NotificationsDropdown />
        ) : null}
        {user?.email ? (
          <span className="erp-topbar-user">
            {user.email}
            {user.role ? ` · ${user.role}` : ''}
          </span>
        ) : null}
        <button type="button" className="erp-topbar-logout" onClick={logout}>
          خروج
        </button>
      </header>

      <div className="erp-body">
        <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="app-sidebar-brand">
            <span className="app-sidebar-brand-mark" aria-hidden />
            <span className="app-sidebar-brand-text">الوحدات</span>
          </div>
          <nav className="app-sidebar-nav">
            {navGroups.map((group) => (
              <div key={group.title} className="app-nav-group">
                <div className="app-nav-group-title">{group.title}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`app-sidebar-link ${page === item.id ? 'active' : ''}`}
                    onClick={() => setPage(item.id)}
                    aria-label={item.label}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="app-main erp-main">{children}</main>
      </div>
    </div>
  )
}
