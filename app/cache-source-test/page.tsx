import { CacheSourceIndicator } from "@/components/cache-source-indicator"

export default function CacheSourceTestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Cache Source Testing</h1>

        <div className="space-y-8">
          {/* Global Stats */}
          <CacheSourceIndicator showGlobalStats={true} />

          {/* Test specific properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CacheSourceIndicator propertyId={706573} />
            <CacheSourceIndicator propertyId={3883072} />
            <CacheSourceIndicator propertyId={7002263} />
            <CacheSourceIndicator propertyId={999999} />
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click "Test Property" to see which cache tier serves the request</li>
            <li>
              Response times indicate the source:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>🟢 &lt;50ms = Redis Cache (hot data)</li>
                <li>🔵 50-200ms = PostgreSQL (warm data)</li>
                <li>🟠 200-500ms = API Call (cold data)</li>
              </ul>
            </li>
            <li>The global stats show overall cache performance</li>
            <li>Test the same property multiple times to see caching in action</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
