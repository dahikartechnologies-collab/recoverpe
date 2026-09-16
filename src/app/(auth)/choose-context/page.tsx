"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { setAppRoleCookie } from "@/lib/auth-cookies";
import { fetchWorkspaceRole } from "@/lib/kiosk-client";
import { persistActiveContext, merchantHomePath } from "@/lib/post-auth-navigation";

export default function ChooseContextPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"merchant" | "agent" | null>(null);

  async function choose(context: "merchant" | "agent") {
    setError("");
    setBusy(context);

    try {
      await persistActiveContext(context);

      if (context === "agent") {
        router.push("/agent-dashboard");
        return;
      }

      const role = await fetchWorkspaceRole();
      setAppRoleCookie(role.role);
      router.push(merchantHomePath(role.role));
    } catch (chooseError) {
      setError(
        chooseError instanceof Error
          ? chooseError.message
          : "Could not switch context."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <p className="type-eyebrow">Same phone, two jobs</p>
          <h1 className="mt-2 text-2xl font-semibold text-recoverpe-black">
            Continue as
          </h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Merchant is your shop books. Agent is RecoverPe field sales. They
            do not share wallets.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-recoverpe-error">{error}</p>
        ) : null}

        <Button
          className="w-full"
          disabled={busy !== null}
          onClick={() => void choose("merchant")}
        >
          {busy === "merchant" ? "Opening shop…" : "Merchant workspace"}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy !== null}
          onClick={() => void choose("agent")}
        >
          {busy === "agent" ? "Opening agent desk…" : "Field agent desk"}
        </Button>
      </CardContent>
    </Card>
  );
}
