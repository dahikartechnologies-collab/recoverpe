import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function ImportGuideCard() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-recoverpe-black">How to Import</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-recoverpe-black">
            From Google Sheets / Excel
          </p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Click File &gt; Download &gt; Comma Separated Values (.csv).
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-recoverpe-black">From Tally</p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Click Export &gt; Current &gt; Select File Format as CSV (Comma Delimited).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
