import type { Metadata } from "next"
import CacheManagementDashboard from "@/components/cache-management-dashboard"

export const metadata: Metadata = {
  title: "Cache Management Dashboard",
  description: "Monitor and manage hybrid cache performance",
}

export default function CacheManagementPage() {
  return <CacheManagementDashboard />
}
