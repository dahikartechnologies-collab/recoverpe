"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  assignVendorCollectionAgent,
  fetchWorkspaceMembers,
} from "@/lib/workspace-client";
import { LedgerWithContact, WorkspaceMember } from "@/types";

interface AssignAgentCardProps {
  contactId: string;
  businessId: string | null;
  ledgers: LedgerWithContact[];
  onAssigned: () => void;
}

export function AssignAgentCard({
  contactId,
  businessId,
  ledgers,
  onAssigned,
}: AssignAgentCardProps) {
  const [fieldStaff, setFieldStaff] = useState<WorkspaceMember[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currentAssignment = useMemo(() => {
    const openLedgers = ledgers.filter((ledger) => ledger.balance_due > 0);
    const assignedIds = new Set(
      openLedgers
        .map((ledger) => ledger.assigned_to_user_id)
        .filter((value): value is string => Boolean(value))
    );

    if (assignedIds.size === 1) {
      return Array.from(assignedIds)[0];
    }

    return "";
  }, [ledgers]);

  useEffect(() => {
    setSelectedAgentId(currentAssignment);
  }, [currentAssignment]);

  useEffect(() => {
    async function loadFieldStaff() {
      setIsLoading(true);
      setError("");

      try {
        const members = await fetchWorkspaceMembers();
        setFieldStaff(
          members.filter(
            (member) => member.role === "field_staff" && member.status === "accepted"
          )
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load field staff."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadFieldStaff();
  }, []);

  async function handleAssign() {
    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await assignVendorCollectionAgent(contactId, {
        assigned_to_user_id: selectedAgentId || null,
        business_id: businessId,
      });

      setSuccessMessage(
        selectedAgentId
          ? `Assigned ${result.updated_ledger_count} open invoice(s) to the selected agent.`
          : `Cleared assignment on ${result.updated_ledger_count} open invoice(s).`
      );
      onAssigned();
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Failed to assign collection agent."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-recoverpe-black">
          Collection assignment
        </h2>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Route open invoices for this vendor to a field staff agent.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-recoverpe-grey-medium">Loading agents...</p>
        ) : fieldStaff.length === 0 ? (
          <p className="text-sm text-recoverpe-grey-medium">
            Invite field staff from Settings → Team before assigning vendors.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="assign-agent"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                Assign to agent
              </label>
              <select
                id="assign-agent"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black"
              >
                <option value="">Unassigned</option>
                {fieldStaff.map((member) => (
                  <option key={member.id} value={member.member_user_id}>
                    {member.full_name || member.email}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={() => void handleAssign()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save assignment"}
            </Button>
          </div>
        )}

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
        {successMessage ? (
          <p className="text-sm text-recoverpe-success">{successMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
