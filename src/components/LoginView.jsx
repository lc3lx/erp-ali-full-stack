import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import './LoginView.css'

export default function LoginView() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message || 'خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell" dir="rtl">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">نظام الحاويات</h1>
        <p className="login-sub">تسجيل الدخول للوصول للبيانات</p>
        <label className="login-field">
          <span>البريد</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="login-field">
          <span>كلمة المرور</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'جاري الدخول…' : 'دخول'}
        </button>
        <p className="login-hint">
          شغّل الباك اند على المنفذ 4000 ثم نفّذ migrate و seed (انظر مجلد backend).
        </p>
      </form>
    </div>
  )
}
