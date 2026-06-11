'use client';

interface SkeletonProps {
  className?: string;
}

/** Base pulsing placeholder box. Dark-mode aware. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  );
}

/** A table-row placeholder. Renders `cols` shimmering cells. */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-50 dark:border-gray-800/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[160px]" />
        </td>
      ))}
    </tr>
  );
}

/** A card-shaped placeholder matching the `.card` surface. */
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-5 flex items-start justify-between ${className}`}>
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
    </div>
  );
}

export default Skeleton;
