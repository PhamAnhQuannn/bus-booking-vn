import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-6 w-48" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-e1">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Skeleton className="h-11 flex-1 rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg md:w-40" />
          <Skeleton className="h-11 w-full rounded-lg md:w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-e1">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-6 w-56" />
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
