import { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentAllocationRecord {
  ledgerId: string;
  allocatedAmount: number;
  allocationSequence: number;
}

export interface FifoAllocationResult {
  alreadyProcessed: boolean;
  inboundPaymentId: string;
  contactId: string;
  status: string;
  totalAllocatedPaise: number;
  unallocatedPaise: number;
  allocations: PaymentAllocationRecord[];
  netOutstanding: number;
}

interface AllocateInboundPaymentFifoRpcRow {
  already_processed: boolean;
  inbound_payment_id: string;
  contact_id: string;
  status: string;
  total_allocated_paise: number;
  unallocated_paise: number;
  allocations: Array<{
    ledger_id: string;
    allocated_amount: number;
    allocation_sequence: number;
  }>;
  net_outstanding: number;
}

export interface AllocateInboundPaymentFifoParams {
  inboundPaymentId: string;
  contactId: string;
  amountPaise: number;
}

function mapRpcResult(row: AllocateInboundPaymentFifoRpcRow): FifoAllocationResult {
  return {
    alreadyProcessed: row.already_processed,
    inboundPaymentId: row.inbound_payment_id,
    contactId: row.contact_id,
    status: row.status,
    totalAllocatedPaise: Number(row.total_allocated_paise ?? 0),
    unallocatedPaise: Number(row.unallocated_paise ?? 0),
    netOutstanding: Number(row.net_outstanding ?? 0),
    allocations: (row.allocations ?? []).map((allocation) => ({
      ledgerId: allocation.ledger_id,
      allocatedAmount: Number(allocation.allocated_amount),
      allocationSequence: Number(allocation.allocation_sequence),
    })),
  };
}

/**
 * FIFO allocation engine — delegates all math and writes to the atomic
 * `allocate_inbound_payment_fifo` Postgres RPC (row-locked, single transaction).
 */
export async function allocateInboundPaymentFifo(
  supabase: SupabaseClient,
  params: AllocateInboundPaymentFifoParams
): Promise<FifoAllocationResult> {
  const { inboundPaymentId, contactId, amountPaise } = params;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("amountPaise must be a positive integer.");
  }

  const { data, error } = await supabase.rpc("allocate_inbound_payment_fifo", {
    p_inbound_payment_id: inboundPaymentId,
    p_contact_id: contactId,
    p_amount_paise: amountPaise,
  });

  if (error) {
    throw new Error(error.message || "FIFO allocation RPC failed.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("FIFO allocation RPC returned an empty payload.");
  }

  return mapRpcResult(data as AllocateInboundPaymentFifoRpcRow);
}

/**
 * Pure FIFO planner (mirrors RPC math) for tests and dry-run previews.
 * Amounts are in paise to avoid floating-point drift.
 */
export function planFifoAllocation(
  openLedgers: Array<{
    id: string;
    balanceDuePaise: number;
    dueDate: string;
  }>,
  amountPaise: number
): PaymentAllocationRecord[] {
  if (amountPaise <= 0) {
    return [];
  }

  const sorted = [...openLedgers].sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate)
  );

  let remainingPaise = amountPaise;
  const allocations: PaymentAllocationRecord[] = [];
  let sequence = 0;

  for (const ledger of sorted) {
    if (remainingPaise <= 0) {
      break;
    }

    if (ledger.balanceDuePaise <= 0) {
      continue;
    }

    const allocPaise =
      remainingPaise >= ledger.balanceDuePaise
        ? ledger.balanceDuePaise
        : remainingPaise;

    sequence += 1;
    allocations.push({
      ledgerId: ledger.id,
      allocatedAmount: allocPaise / 100,
      allocationSequence: sequence,
    });

    remainingPaise -= allocPaise;

    if (allocPaise < ledger.balanceDuePaise) {
      break;
    }
  }

  return allocations;
}
