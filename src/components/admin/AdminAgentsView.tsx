"use client";

import { FormEvent, useCallback, useState } from "react";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
  discountBpsToPercent,
  discountPercentToBps,
  formatDiscountCapBps,
} from "@/lib/agent/discount-cap";
import {
  AdminAccessDeniedError,
  createAdminAgent,
  createAdminAgentForMe,
  fetchAdminAgents,
  updateAdminAgent,
} from "@/lib/admin-client";
import { AdminAgentRecord } from "@/types";
import { MoreVertical, UserPlus } from "lucide-react";

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
    case "offboarded":
      return "danger";
    case "pending_kyc":
      return "warning";
    default:
      return "neutral";
  }
}

function formatCurrencyInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminAgentsView({ initialAgents }: AdminAgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discountCapBps, setDiscountCapBps] = useState("1000");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editingAgent, setEditingAgent] = useState<AdminAgentRecord | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDiscountPercent, setEditDiscountPercent] = useState("10");
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");

  const reloadAgents = useCallback(async () => {
    const response = await fetchAdminAgents();
    setAgents(response.agents);
  }, []);

  function openEditDrawer(agent: AdminAgentRecord) {
    setEditingAgent(agent);
    setEditDisplayName(agent.display_name);
    setEditPhone(agent.user_phone ?? "");
    setEditDiscountPercent(String(discountBpsToPercent(agent.discount_cap_bps)));
    setEditStatus(agent.status === "suspended" ? "suspended" : "active");
  }

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

  async function handleSaveAgentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAgent) {
      return;
    }

    setPendingAction(`edit-${editingAgent.id}`);
    setToast(null);

    try {
      const result = await updateAdminAgent(editingAgent.id, {
        display_name: editDisplayName.trim(),
        phone_number: editPhone.trim() || undefined,
        discount_cap_bps: discountPercentToBps(Number(editDiscountPercent)),
        status: editStatus,
      });

      setToast({ message: result.message, variant: "success" });
      setEditingAgent(null);
      await reloadAgents();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to update agent.",
        variant: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRevokeAgent() {
    if (!editingAgent) {
      return;
    }

    const confirmed = window.confirm(
      `Revoke agent access for ${editingAgent.display_name}? This soft-deletes their agent profile.`
    );

    if (!confirmed) {
      return;
    }

    setPendingAction(`revoke-${editingAgent.id}`);

    try {
      const result = await updateAdminAgent(editingAgent.id, { revoke: true });
      setToast({ message: result.message, variant: "success" });
      setEditingAgent(null);
      await reloadAgents();
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to revoke agent.",
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
        description="Promote users, tune discount caps, and review referral performance dossiers."
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
                Max discount (%)
              </span>
              <Input
                className="mt-1 tabular-nums"
                inputMode="decimal"
                value={String(discountBpsToPercent(Number(discountCapBps) || 0))}
                onChange={(event) =>
                  setDiscountCapBps(
                    String(discountPercentToBps(Number(event.target.value)))
                  )
                }
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
            Agent performance dossier ({agents.length})
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
                  <TableHead>Referrals</TableHead>
                  <TableHead>Active merchants</TableHead>
                  <TableHead>Commission earned</TableHead>
                  <TableHead>Pending commission</TableHead>
                  <TableHead>Cap</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
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
                        {agent.user_phone ?? agent.user_email ?? agent.user_id}
                      </p>
                      <p className="mt-1 font-mono text-xs text-recoverpe-muted">
                        {agent.referral_code}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-black">
                      {agent.total_referrals ?? 0}
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-black">
                      {agent.active_merchants ?? 0}
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-black">
                      {formatCurrencyInr(agent.total_commission_earned_inr ?? 0)}
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-black">
                      {formatCurrencyInr(agent.pending_commission_inr ?? 0)}
                    </TableCell>
                    <TableCell className="text-recoverpe-black">
                      {formatDiscountCapBps(agent.discount_cap_bps)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={agentStatusTone(agent.status)}>
                        {agent.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${agent.display_name}`}
                        onClick={() => openEditDrawer(agent)}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={editingAgent !== null}
        onClose={() => setEditingAgent(null)}
        title="Edit field agent"
      >
        <form className="space-y-4" onSubmit={(event) => void handleSaveAgentEdit(event)}>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">Agent name</span>
            <Input
              className="mt-1"
              value={editDisplayName}
              onChange={(event) => setEditDisplayName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">Phone</span>
            <Input
              className="mt-1"
              value={editPhone}
              onChange={(event) => setEditPhone(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">
              Max discount (0–12%)
            </span>
            <Input
              className="mt-1 tabular-nums"
              inputMode="decimal"
              value={editDiscountPercent}
              onChange={(event) => setEditDiscountPercent(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">Status</span>
            <select
              className="mt-1 h-10 w-full rounded-md border border-recoverpe-line-strong bg-recoverpe-white px-3 text-sm"
              value={editStatus}
              onChange={(event) =>
                setEditStatus(event.target.value as "active" | "suspended")
              }
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleRevokeAgent()}
              disabled={Boolean(pendingAction?.startsWith("revoke-"))}
            >
              Revoke agent access
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingAgent(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={Boolean(pendingAction?.startsWith("edit-"))}
              >
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
