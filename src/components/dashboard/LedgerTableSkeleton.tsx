import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const ROW_COUNT = 8;

export function LedgerTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light/60">
                <th className="w-10 px-5 py-3">
                  <Skeleton className="h-4 w-4 rounded" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-14" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="px-5 py-3 text-right">
                  <Skeleton className="ml-auto h-3 w-14" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROW_COUNT }).map((_, index) => (
                <tr
                  key={index}
                  className="border-b border-recoverpe-grey-light last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-4 rounded" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
