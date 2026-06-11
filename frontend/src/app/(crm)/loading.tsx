import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* KPI / stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart-sized blocks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[220px] w-full" />
        </div>
        <div className="card p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>

      {/* Table block */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
