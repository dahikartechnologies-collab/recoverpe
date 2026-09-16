"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import {
  AdminAccessDeniedError,
  createAdminAgent,
  createAdminAgentForMe,
  fetchAdminAgents,
} from "@/lib/admin-client";
import { AdminAgentRecord } from "@/types";

interface AdminAgentsViewProps {
  initialAgents: AdminAgentRecord[];
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

export function AdminAgentsView({ initialAgents }: AdminAgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discountCapBps, setDiscountCapBps] = useState("1000");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const reloadAgents = useCallback(async () => {
    const response = await fetchAdminAgents();
    setAgents(response.agents);
  }, []);

  async function handleCreateByPhone(event: React.FormEvent) {
    event.preventDefault();
    setPendingAction("create");
    setToast(null);

    try {
      const result = await createAdminAgent({
        phone_number: phoneNumber.trim(),
        display_name: displayName.trim() || undefined,
        discount_cap_bps: Number(discountCapBps),
      });

      setToast({ message: result.message, variant: "success" });
      setPhoneNumber("");
      setDisplayName("");
      await reloadAgents();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to create agent.",
        variant: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMakeMeAgent() {
    setPendingAction("me");
    setToast(null);

    try {
      const result = await createAdminAgentForMe();
      setToast({ message: result.message, variant: "success" });
      await reloadAgents();
    } catch (error) {
      if (error instanceof AdminAccessDeniedError) {
        setToast({ message: error.message, variant: "error" });
        return;
      }

      setToast({
        message:
          error instanceof Error ? error.message : "Failed to assign agent row.",
        variant: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Recoverpe Control Room
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-recoverpe-black">
          Field Agent Management
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Promote users to the agent network so they can access the Identity
          Switcher without manual Supabase edits.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-recoverpe-black">
                Founder test shortcut
              </h2>
              <p className="mt-1 text-sm text-recoverpe-grey-medium">
                Instantly assigns an active agent row to your logged-in account.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleMakeMeAgent()}
              disabled={pendingAction === "me"}
            >
              {pendingAction === "me" ? "Assigning..." : "Make Me An Agent (Test)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-recoverpe-black">
            Create agent by phone
          </h2>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateByPhone}>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">Phone number</span>
              <input
                className="mt-1 w-full rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm"
                placeholder="+919876543210"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">Display name</span>
              <input
                className="mt-1 w-full rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm"
                placeholder="Optional"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">
                Discount cap (bps)
              </span>
              <input
                className="mt-1 w-full rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm"
                inputMode="numeric"
                value={discountCapBps}
                onChange={(event) => setDiscountCapBps(event.target.value)}
              />
            </label>
            <div className="md:col-span-3">
              <Button type="submit" disabled={pendingAction === "create"}>
                {pendingAction === "create" ? "Creating..." : "Create Active Agent"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-recoverpe-grey-light px-4 py-3">
            <h2 className="text-sm font-semibold text-recoverpe-black">
              Recent agents ({agents.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Referral code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cap (bps)</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-recoverpe-grey-medium"
                      colSpan={5}
                    >
                      No agents yet. Use the form above to create one.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-recoverpe-grey-light last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-recoverpe-black">
                          {agent.display_name}
                        </p>
                        <p className="text-xs text-recoverpe-grey-medium">
                          {agent.user_email ?? agent.user_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-recoverpe-grey-medium">
                        {agent.user_phone ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-recoverpe-black">
                        {agent.referral_code}
                      </td>
                      <td className="px-4 py-3 capitalize text-recoverpe-black">
                        {agent.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {agent.discount_cap_bps}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
