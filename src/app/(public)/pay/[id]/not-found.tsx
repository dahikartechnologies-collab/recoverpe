import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function PayNotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="text-xl font-semibold text-recoverpe-black">
            Payment link unavailable
          </h1>
          <p className="text-sm text-recoverpe-grey-medium">
            This invoice may already be settled, expired, or the link is invalid.
          </p>
          <Link href="/">
            <Button type="button" variant="secondary">
              Go to Recoverpe
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
