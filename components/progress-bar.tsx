"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, Zap, AlertTriangle, CheckCircle, Pause, Play } from "lucide-react"

interface ProgressBarProps {
  percentage: number
  processedItems: number
  totalItems: number
  failedItems?: number
  processingRate?: number
  estimatedTimeRemaining?: number
  status?: "running" | "paused" | "completed" | "failed"
  label?: string
}

export function ProgressBar({
  percentage,
  processedItems,
  totalItems,
  failedItems = 0,
  processingRate,
  estimatedTimeRemaining,
  status = "running",
  label,
}: ProgressBarProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return <Play className="h-3 w-3" />
      case "paused":
        return <Pause className="h-3 w-3" />
      case "completed":
        return <CheckCircle className="h-3 w-3" />
      case "failed":
        return <AlertTriangle className="h-3 w-3" />
      default:
        return <Zap className="h-3 w-3" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-500"
      case "paused":
        return "bg-yellow-500"
      case "completed":
        return "bg-green-500"
      case "failed":
        return "bg-red-500"
      default:
        return "bg-blue-500"
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {getStatusIcon()}
            <span className="ml-1 capitalize">{status}</span>
          </Badge>
          {label && (
            <Badge variant="secondary" className="text-xs">
              {label}
            </Badge>
          )}
        </div>
        <div className="text-sm font-medium">{percentage.toFixed(1)}%</div>
      </div>

      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div
          className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {processedItems.toLocaleString()} / {totalItems.toLocaleString()}
          </span>
          {failedItems > 0 && (
            <Badge variant="destructive" className="text-xs">
              {failedItems} failed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {processingRate && (
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{processingRate.toFixed(1)}/sec</span>
            </div>
          )}
          {estimatedTimeRemaining && status === "running" && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>ETA: {formatTime(estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
