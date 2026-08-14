"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { lookupContactByPhone } from "@/lib/contacts";
import { createLedgerEntry, UpgradeRequiredError } from "@/lib/ledgers";
import { useWorkspaceStore } from "@/store/workspace-store";

type PdfMode = "generate_tax_invoice" | "no_pdf";

export function NewLedgerModal() {
  const isOpen = useWorkspaceStore((state) => state.isLedgerModalOpen);
  const closeLedgerModal = useWorkspaceStore((state) => state.closeLedgerModal);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId]
  );

  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [pdfMode, setPdfMode] = useState<PdfMode>("no_pdf");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUpContact, setIsLookingUpContact] = useState(false);

  const canGenerateTaxInvoice = mode === "business" && Boolean(activeBusiness);

  useEffect(() => {
    if (phoneNumber.length !== 10) {
      return;
    }

    let isCancelled = false;

    async function lookupContact() {
      setIsLookingUpContact(true);

      try {
        const contact = await lookupContactByPhone(phoneNumber);

        if (!isCancelled && contact) {
          setContactName(contact.name);
          if (contact.client_gstin) {
            setClientGstin(contact.client_gstin);
          }
        }
      } catch {
        // Ignore lookup errors during auto-fill.
      } finally {
        if (!isCancelled) {
          setIsLookingUpContact(false);
        }
      }
    }

    void lookupContact();

    return () => {
      isCancelled = true;
    };
  }, [phoneNumber]);

  function resetForm() {
    setContactName("");
    setPhoneNumber("");
    setAmount("");
    setDueDate("");
    setClientGstin("");
    setUpiVpa("");
    setPdfMode("no_pdf");
    setError("");
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    resetForm();
    closeLedgerModal();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid amount greater than zero.");
      }

      const generateTaxInvoice =
        canGenerateTaxInvoice && pdfMode === "generate_tax_invoice";

      if (generateTaxInvoice && !upiVpa.trim()) {
        throw new Error("UPI VPA is required to generate a tax invoice with QR code.");
      }

      await createLedgerEntry({
        contact_name: contactName.trim(),
        phone_number: phoneNumber.trim(),
        amount: parsedAmount,
        due_date: dueDate,
        generate_tax_invoice: generateTaxInvoice,
        workspace_mode: mode,
        business_id: mode === "business" ? activeBusinessId : null,
        client_gstin: clientGstin.trim() || null,
        upi_vpa: upiVpa.trim() || null,
      });

      bumpLedgerRefresh();
      resetForm();
      closeLedgerModal();
    } catch (submitError) {
      if (submitError instanceof UpgradeRequiredError) {
        closeLedgerModal();
        openUpgradeModal();
        return;
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create ledger entry."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Entry">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="contactName"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Contact name
          </label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Client or friend name"
            required
          />
        </div>

        <div>
          <label
            htmlFor="phoneNumber"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Phone number
          </label>
          <div className="flex overflow-hidden rounded-md border border-recoverpe-grey-light focus-within:border-recoverpe-black">
            <span className="flex items-center border-r border-recoverpe-grey-light bg-recoverpe-grey-light px-3 text-sm font-medium text-recoverpe-black">
              +91
            </span>
            <Input
              id="phoneNumber"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneNumber}
              onChange={(event) =>
                setPhoneNumber(event.target.value.replace(/\D/g, ""))
              }
              placeholder="10-digit mobile number"
              className="rounded-none border-0 focus:border-0"
              required
            />
          </div>
          {isLookingUpContact ? (
            <p className="mt-1.5 text-xs text-recoverpe-grey-medium">
              Looking up existing contact...
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="amount"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Amount (INR)
            </label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label
              htmlFor="dueDate"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Due date
            </label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
        </div>

        {canGenerateTaxInvoice ? (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-recoverpe-black">
                Document mode
              </p>
              <div className="inline-flex rounded-md border border-recoverpe-grey-light p-1">
                <button
                  type="button"
                  onClick={() => setPdfMode("generate_tax_invoice")}
                  className={`min-h-10 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    pdfMode === "generate_tax_invoice"
                      ? "bg-recoverpe-black text-recoverpe-white"
                      : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
                  }`}
                >
                  Generate Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setPdfMode("no_pdf")}
                  className={`min-h-10 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    pdfMode === "no_pdf"
                      ? "bg-recoverpe-black text-recoverpe-white"
                      : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
                  }`}
                >
                  No PDF, Just Amount
                </button>
              </div>
            </div>

            {pdfMode === "generate_tax_invoice" ? (
              <>
                <div>
                  <label
                    htmlFor="clientGstin"
                    className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                  >
                    Client GSTIN (optional)
                  </label>
                  <Input
                    id="clientGstin"
                    value={clientGstin}
                    onChange={(event) =>
                      setClientGstin(event.target.value.toUpperCase())
                    }
                    placeholder="For CGST/SGST vs IGST split"
                  />
                </div>

                <div>
                  <label
                    htmlFor="upiVpa"
                    className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                  >
                    UPI VPA
                  </label>
                  <Input
                    id="upiVpa"
                    value={upiVpa}
                    onChange={(event) => setUpiVpa(event.target.value.trim())}
                    placeholder="merchant@bank"
                    required
                  />
                  <p className="mt-1.5 text-xs text-recoverpe-grey-medium">
                    Used for the UPI QR code on {activeBusiness?.business_name}
                    &apos;s invoice.
                  </p>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-recoverpe-grey-medium">
            {mode === "personal"
              ? "Personal entries do not generate PDF invoices."
              : "Select a business profile to enable tax invoice generation."}
          </p>
        )}

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
