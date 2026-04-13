import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function calculateMatchingPercentage(score: number): number {
  return Math.round(score * 100)
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'submitted': 'bg-blue-100 text-blue-800',
    'under_review': 'bg-yellow-100 text-yellow-800',
    'shortlisted': 'bg-green-100 text-green-800',
    'interview_scheduled': 'bg-purple-100 text-purple-800',
    'selected': 'bg-emerald-100 text-emerald-800',
    'rejected': 'bg-red-100 text-red-800',
    'withdrawn': 'bg-gray-100 text-gray-800',
    'pending': 'bg-orange-100 text-orange-800',
    'approved': 'bg-green-100 text-green-800',
    'verified': 'bg-blue-100 text-blue-800',
    'active': 'bg-green-100 text-green-800',
    'draft': 'bg-gray-100 text-gray-800',
    'closed': 'bg-red-100 text-red-800'
  }
  return statusColors[status] || 'bg-gray-100 text-gray-800'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[+]?[\d\s-()]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}