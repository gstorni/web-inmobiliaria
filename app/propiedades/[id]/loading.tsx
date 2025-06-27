export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Skeleton */}
            <div className="bg-white rounded-lg shadow">
              <div className="h-96 md:h-[500px] bg-gray-300 animate-pulse rounded-t-lg"></div>
            </div>

            {/* Content Skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-8 bg-gray-300 animate-pulse rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-300 animate-pulse rounded w-1/2 mb-6"></div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-gray-300 animate-pulse rounded"></div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="h-4 bg-gray-300 animate-pulse rounded"></div>
                <div className="h-4 bg-gray-300 animate-pulse rounded"></div>
                <div className="h-4 bg-gray-300 animate-pulse rounded w-3/4"></div>
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-300 animate-pulse rounded w-1/2 mb-4"></div>
              <div className="space-y-3">
                <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
                <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
                <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-300 animate-pulse rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-gray-300 animate-pulse rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
