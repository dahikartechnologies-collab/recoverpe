"use client";

import { useCallback, useState } from "react";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import {
  AdminAccessDeniedError,
  createAdminAgent,
  createAdminAgentForMe,
  fetchAdminAgents,
} from "@/lib/admin-client";
import { AdminAgentRecord } from "@/types";
import { UserPlus } from "lucide-react";

interface AdminAgentsViewProps {
  initialAgents: AdminAgentRecord[];
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function agentStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
    case "rejected":
    case "inactive":
      return "danger";
    case "pending":
    case "pending_kyc":
    case "kyc_pending":
      return "warning";
    default:
      return "neutral";
  }
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
      <PageHeader
        eyebrow="Recoverpe Control Room"
        title="Field Agent Management"
        description="Promote users to the agent network so they can access the Identity Switcher without manual Supabase edits."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-section-title">Founder test shortcut</h2>
            <p className="mt-1 text-sm text-recoverpe-muted">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Create agent by phone</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateByPhone}>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">Phone number</span>
              <Input
                className="mt-1"
                placeholder="+919876543210"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">Display name</span>
              <Input
                className="mt-1"
                placeholder="Optional"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">
                Discount cap (bps)
              </span>
              <Input
                className="mt-1"
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
        <CardHeader>
          <h2 className="type-section-title">
            Recent agents ({agents.length})
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-5 w-5" aria-hidden />}
              title="No agents yet"
              description="Use the form above to create an active field agent."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Agent</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Referral code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cap (bps)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <p className="font-medium text-recoverpe-black">
                        {agent.display_name}
                      </p>
                      <p className="type-data-secondary mt-0.5">
                        {agent.user_email ?? agent.user_id}
                      </p>
                    </TableCell>
                    <TableCell className="text-recoverpe-muted">
                      {agent.user_phone ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-recoverpe-black">
                      {agent.referral_code}
                    </TableCell>
                    <TableCell>
                      <Badge tone={agentStatusTone(agent.status)}>
                        {agent.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-black">
                      {agent.discount_cap_bps}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
