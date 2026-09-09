import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const ROW_COUNT = 6;

export function VendorTableSkeleton() {
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
                  <Skeleton className="h-3 w-24" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-28" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" />
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
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-10" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-16" />
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
