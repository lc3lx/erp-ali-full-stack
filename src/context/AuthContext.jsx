import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest, getStoredToken, getStoredUser, setStoredSession, setUnauthorizedHandler } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState(getStoredUser)

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!data?.token) {
      throw new Error(data?.error?.message || 'فشل تسجيل الدخول')
    }
    setStoredSession(data.token, data.user)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    setStoredSession(null, null)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStoredSession(null, null)
      setToken(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(() => {})
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [token, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
