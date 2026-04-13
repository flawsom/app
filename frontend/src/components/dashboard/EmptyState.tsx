import React from 'react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-6xl mb-4 opacity-50">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-blue-600 hover:bg-blue-700">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default EmptyState