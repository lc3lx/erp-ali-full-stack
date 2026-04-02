import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.get('/notifications', { page: 1, pageSize: 20 })
      setItems(data.items ?? [])
      setErr('')
    } catch (e) {
      setErr(e.message)
      setItems([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  const unread = items.filter((n) => !n.readAt).length

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`, {})
      load()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="erp-notif-wrap">
      <button
        type="button"
        className="erp-notif-bell"
        aria-label="الإشعارات"
        onClick={() => setOpen((o) => !o)}
      >
        🔔{unread > 0 ? <span className="erp-notif-count">{unread}</span> : null}
      </button>
      {open ? (
        <div className="erp-notif-panel" dir="rtl">
          <div className="erp-notif-header">
            <span>الإشعارات</span>
            <button type="button" className="erp-notif-link" onClick={() => api.post('/notifications/read-all', {}).then(load)}>
              تعيين الكل كمقروء
            </button>
          </div>
          {err ? <div className="erp-notif-err">{err}</div> : null}
          <ul className="erp-notif-list">
            {items.length === 0 ? <li className="erp-notif-empty">لا إشعارات</li> : null}
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? 'erp-notif-item read' : 'erp-notif-item'}>
                <div className="erp-notif-title">{n.title}</div>
                {n.body ? <div className="erp-notif-body">{n.body}</div> : null}
                {!n.readAt ? (
                  <button type="button" className="erp-notif-mini" onClick={() => markRead(n.id)}>
                    مقروء
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
