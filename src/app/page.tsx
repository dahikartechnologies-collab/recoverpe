import Link from "next/link";
import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <RecoverpeLogo size="lg" priority />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-widest text-recoverpe-grey-medium">
            Dahikar Technologies
          </p>
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            SaaS platform for accounts receivable automation and personal
            lending reminders.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
