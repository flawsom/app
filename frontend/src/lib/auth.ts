import Cookies from 'js-cookie'
import { User, AuthState } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async login(email: string, password: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      this.authState.isLoading = true
      
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        this.authState.user = data.user
        this.authState.token = data.access_token
        this.authState.isAuthenticated = true
        
        // Store tokens in cookies
        Cookies.set('access_token', data.access_token, { expires: 1/24 }) // 1 hour
        Cookies.set('refresh_token', data.refresh_token, { expires: 7 }) // 7 days
        
        return { success: true, user: data.user, token: data.access_token }
      } else {
        return { success: false, error: data.message || 'Login failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error' }
    } finally {
      this.authState.isLoading = false
    }
  }

  async register(userData: {
    email: string
    password: string
    role: string
    firstName: string
    lastName: string
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      this.authState.isLoading = true
      
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (response.ok) {
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.message || 'Registration failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error' }
    } finally {
      this.authState.isLoading = false
    }
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken()
      if (token) {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      this.clearAuthState()
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = Cookies.get('refresh_token')
      if (!refreshToken) return false

      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        this.authState.token = data.access_token
        Cookies.set('access_token', data.access_token, { expires: 1/24 })
        return true
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = this.getToken()
      if (!token) return null

      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        this.authState.user = data.user
        this.authState.isAuthenticated = true
        return data.user
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshToken()
        if (refreshed) {
          return this.getCurrentUser()
        }
        this.clearAuthState()
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  getToken(): string | null {
    return this.authState.token || Cookies.get('access_token') || null
  }

  getUser(): User | null {
    return this.authState.user
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated || !!this.getToken()
  }

  getAuthState(): AuthState {
    return { ...this.authState }
  }

  private clearAuthState(): void {
    this.authState = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    }
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
  }

  // Initialize auth state from cookies on app start
  async initializeAuth(): Promise<void> {
    const token = Cookies.get('access_token')
    if (token) {
      this.authState.token = token
      await this.getCurrentUser()
    }
  }
}

// API utility function with auth
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const auth = AuthService.getInstance()
    const token = auth.getToken()
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true, data }
    } else if (response.status === 401) {
      // Try to refresh token
      const refreshed = await auth.refreshToken()
      if (refreshed) {
        // Retry the request with new token
        return apiRequest(endpoint, options)
      } else {
        // Refresh failed, redirect to login
        auth.logout()
        window.location.href = '/login'
        return { success: false, error: 'Authentication failed' }
      }
    } else {
      return { success: false, error: data.message || 'Request failed' }
    }
  } catch (error) {
    return { success: false, error: 'Network error' }
  }
}

// Role-based access control utilities
export function hasRole(user: User | null, role: string): boolean {
  return user?.role === role
}

export function hasAnyRole(user: User | null, roles: string[]): boolean {
  return user ? roles.includes(user.role) : false
}

export function canAccessRoute(user: User | null, requiredRoles: string[]): boolean {
  if (!user) return false
  return requiredRoles.includes(user.role)
}