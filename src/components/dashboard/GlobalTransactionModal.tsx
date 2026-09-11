"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ensureContact, lookupContactByPhone } from "@/lib/contacts";
import { formatCurrency } from "@/lib/gst";
import {
  createLedgerEntry,
  uploadCustomLedgerPdf,
  UpgradeRequiredError,
} from "@/lib/ledgers";
import { fetchCurrentUser } from "@/lib/users";
import { logWalletAdvance } from "@/lib/wallet";
import { useWorkspaceStore } from "@/store/workspace-store";

const MAX_CUSTOM_PDF_BYTES = 4 * 1024 * 1024;

type TransactionTab = "udhaar" | "jama";
type PdfMode = "generate_tax_invoice" | "no_pdf" | "upload_custom_pdf";
type AdvancePaymentMethod = "cash_manual" | "bank_transfer" | "cheque" | "upi_link";

function TransactionTypeToggle({
  activeTab,
  onChange,
}: {
  activeTab: TransactionTab;
  onChange: (tab: TransactionTab) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange("udhaar")}
        className={`min-h-14 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
          activeTab === "udhaar"
            ? "border-[#EF4444] bg-[#FEF2F2] text-[#B91C1C]"
            : "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light/60"
        }`}
      >
        Give Credit (Udhaar)
      </button>
      <button
        type="button"
        onClick={() => onChange("jama")}
        className={`min-h-14 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
          activeTab === "jama"
            ? "border-[#059669] bg-[#ECFDF5] text-[#065F46]"
            : "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light/60"
        }`}
      >
        Receive Advance (Jama)
      </button>
    </div>
  );
}

export function GlobalTransactionModal() {
  const isOpen = useWorkspaceStore((state) => state.isLedgerModalOpen);
  const activeTab = useWorkspaceStore((state) => state.ledgerModalTab);
  const ledgerModalPrefill = useWorkspaceStore((state) => state.ledgerModalPrefill);
  const closeLedgerModal = useWorkspaceStore((state) => state.closeLedgerModal);
  const setLedgerModalTab = useWorkspaceStore((state) => state.setLedgerModalTab);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);

  const amountInputRef = useRef<HTMLInputElement>(null);

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId]
  );

  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [pdfMode, setPdfMode] = useState<PdfMode>("no_pdf");
  const [customPdfFile, setCustomPdfFile] = useState<File | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<AdvancePaymentMethod>("cash_manual");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUpContact, setIsLookingUpContact] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const canGenerateTaxInvoice = mode === "business" && Boolean(activeBusiness);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (ledgerModalPrefill) {
      setContactName(ledgerModalPrefill.contactName);
      setPhoneNumber(ledgerModalPrefill.phoneNumber);
    }

    let cancelled = false;

    async function loadDefaultUpiVpa() {
      try {
        const user = await fetchCurrentUser();

        if (!cancelled && user.default_upi_vpa) {
          setUpiVpa((current) => current || user.default_upi_vpa || "");
        }
      } catch {
        // Ignore profile load errors for UPI prefill.
      }
    }

    void loadDefaultUpiVpa();

    return () => {
      cancelled = true;
    };
  }, [isOpen, ledgerModalPrefill]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) {
      setWalletBalance(0);
      setUseWalletBalance(false);
      return;
    }

    if (phoneNumber.length !== 10) {
      setWalletBalance(0);
      setUseWalletBalance(false);
      return;
    }

    let isCancelled = false;

    async function lookupContact() {
      setIsLookingUpContact(true);

      try {
        const contact = await lookupContactByPhone(phoneNumber);

        if (!isCancelled) {
          if (contact) {
            setContactName(contact.name);
            if (contact.client_gstin) {
              setClientGstin(contact.client_gstin);
            }
            setContactEmail(contact.email ?? "");
            const balance = Number(contact.wallet_balance ?? 0);
            setWalletBalance(balance);
            setUseWalletBalance(balance > 0 && activeTab === "udhaar");
          } else {
            setWalletBalance(0);
            setUseWalletBalance(false);
            if (activeTab === "jama") {
              setContactEmail("");
            }
          }
        }
      } catch {
        if (!isCancelled) {
          setWalletBalance(0);
          setUseWalletBalance(false);
        }
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
  }, [phoneNumber, isOpen, activeTab]);

  function resetForm() {
    setContactName("");
    setPhoneNumber("");
    setContactEmail("");
    setAmount("");
    setDueDate("");
    setClientGstin("");
    setUpiVpa("");
    setPdfMode("no_pdf");
    setCustomPdfFile(null);
    setWalletBalance(0);
    setUseWalletBalance(false);
    setPaymentMethod("cash_manual");
    setReferenceId("");
    setError("");
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    resetForm();
    closeLedgerModal();
  }

  function finishSuccess(message: string) {
    setSuccessToast(message);
    bumpLedgerRefresh();
    bumpWalletRefresh();
    resetForm();
    closeLedgerModal();
  }

  async function handleSubmitJama(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const parsed = Number(amount);

      if (!contactName.trim()) {
        throw new Error("Enter the vendor or customer name.");
      }

      if (phoneNumber.length !== 10) {
        throw new Error("Enter a valid 10-digit mobile number.");
      }

      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Enter a valid advance amount.");
      }

      const contact = await ensureContact({
        contact_name: contactName.trim(),
        phone_number: phoneNumber.trim(),
        contact_email: contactEmail.trim() || null,
      });

      const response = await logWalletAdvance({
        contact_id: contact.id,
        amount: parsed,
        payment_method: paymentMethod,
        reference_id: referenceId.trim() || null,
      });

      finishSuccess(
        `${formatCurrency(parsed)} advance logged for ${contact.name}. Wallet balance: ${formatCurrency(response.wallet_balance)}.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to log advance payment."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitUdhaar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const parsed = Number(amount);

      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Enter a valid amount greater than zero.");
      }

      if (!dueDate) {
        throw new Error("Due date is required.");
      }

      const generateTaxInvoice =
        canGenerateTaxInvoice && pdfMode === "generate_tax_invoice";
      const uploadCustomPdf =
        canGenerateTaxInvoice && pdfMode === "upload_custom_pdf";

      if (generateTaxInvoice && !upiVpa.trim()) {
        throw new Error("UPI VPA is required to generate a tax invoice with QR code.");
      }

      if (uploadCustomPdf) {
        if (!customPdfFile) {
          throw new Error("Select a PDF file to upload.");
        }

        if (customPdfFile.type && customPdfFile.type !== "application/pdf") {
          throw new Error("Uploaded file must be a PDF document.");
        }

        if (customPdfFile.size > MAX_CUSTOM_PDF_BYTES) {
          throw new Error("PDF must be 4MB or smaller.");
        }
      }

      const ledger = await createLedgerEntry({
        contact_name: contactName.trim(),
        phone_number: phoneNumber.trim(),
        contact_email: contactEmail.trim() || null,
        amount: parsed,
        due_date: dueDate,
        generate_tax_invoice: generateTaxInvoice,
        upload_custom_pdf: uploadCustomPdf,
        use_wallet_balance: useWalletBalance && walletBalance > 0,
        workspace_mode: mode,
        business_id: mode === "business" ? activeBusinessId : null,
        client_gstin: clientGstin.trim() || null,
        upi_vpa: upiVpa.trim() || null,
      });

      if (uploadCustomPdf && customPdfFile) {
        await uploadCustomLedgerPdf(ledger.id, customPdfFile);
      }

      finishSuccess(
        `Credit of ${formatCurrency(parsed)} recorded for ${contactName.trim()}.`
      );
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

  const sharedContactFields = (
    <>
      <div>
        <label
          htmlFor="globalContactName"
          className="mb-1.5 block text-sm font-medium text-recoverpe-black"
        >
          Name
        </label>
        <Input
          id="globalContactName"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          placeholder="Vendor or customer name"
          required
        />
      </div>

      <div>
        <label
          htmlFor="globalPhoneNumber"
          className="mb-1.5 block text-sm font-medium text-recoverpe-black"
        >
          Phone number
        </label>
        <div className="flex overflow-hidden rounded-md border border-recoverpe-grey-light focus-within:border-recoverpe-black">
          <span className="flex items-center border-r border-recoverpe-grey-light bg-recoverpe-grey-light px-3 text-sm font-medium text-recoverpe-black">
            +91
          </span>
          <Input
            id="globalPhoneNumber"
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
    </>
  );

  const amountField = (
    <div>
      <label
        htmlFor="globalAmount"
        className="mb-2 block text-sm font-medium text-recoverpe-black"
      >
        Amount (₹)
      </label>
      <input
        ref={amountInputRef}
        id="globalAmount"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="0"
        required
        className={`w-full rounded-lg border px-4 py-4 text-center text-4xl font-semibold tabular-nums tracking-tight focus:outline-none ${
          activeTab === "jama"
            ? "border-[#059669]/40 bg-[#ECFDF5] text-[#065F46] focus:border-[#059669]"
            : "border-[#EF4444]/30 bg-[#FEF2F2] text-[#B91C1C] focus:border-[#EF4444]"
        }`}
      />
    </div>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="New Entry">
        <div className="space-y-5">
          <TransactionTypeToggle
            activeTab={activeTab}
            onChange={setLedgerModalTab}
          />

          {activeTab === "jama" ? (
            <form className="space-y-4" onSubmit={handleSubmitJama}>
              {sharedContactFields}
              {amountField}

              <div>
                <label
                  htmlFor="jamaPaymentMethod"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Payment method
                </label>
                <select
                  id="jamaPaymentMethod"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as AdvancePaymentMethod)
                  }
                  className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black focus:border-[#059669] focus:outline-none"
                >
                  <option value="cash_manual">Cash</option>
                  <option value="upi_link">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="jamaReferenceId"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Reference (optional)
                </label>
                <Input
                  id="jamaReferenceId"
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                  placeholder="UTR, receipt note"
                />
              </div>

              {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

              <Button
                type="submit"
                className="w-full bg-[#059669] hover:bg-[#047857]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Receive Advance"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmitUdhaar}>
              {sharedContactFields}
              {amountField}

              <div>
                <label
                  htmlFor="globalDueDate"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Due date
                </label>
                <Input
                  id="globalDueDate"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="globalContactEmail"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Email (optional)
                </label>
                <Input
                  id="globalContactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="vendor@company.com"
                />
              </div>

              {walletBalance > 0 ? (
                <div className="rounded-lg border border-[#059669]/30 bg-[#ECFDF5] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#065F46]">
                        Apply wallet balance
                      </p>
                      <p className="mt-1 text-xs text-[#047857]">
                        {formatCurrency(walletBalance)} advance available on this khata.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useWalletBalance}
                      onClick={() => setUseWalletBalance((current) => !current)}
                      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors ${
                        useWalletBalance
                          ? "border-[#059669] bg-[#059669]"
                          : "border-recoverpe-grey-light bg-recoverpe-white"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          useWalletBalance ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ) : null}

              {canGenerateTaxInvoice ? (
                <>
                  <div>
                    <p className="mb-2 text-sm font-medium text-recoverpe-black">
                      Document mode
                    </p>
                    <div className="inline-flex flex-wrap rounded-md border border-recoverpe-grey-light p-1">
                      <button
                        type="button"
                        onClick={() => setPdfMode("generate_tax_invoice")}
                        className={`min-h-10 rounded px-3 py-2 text-sm font-medium transition-colors ${
                          pdfMode === "generate_tax_invoice"
                            ? "bg-recoverpe-black text-recoverpe-white"
                            : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
                        }`}
                      >
                        Tax Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfMode("upload_custom_pdf")}
                        className={`min-h-10 rounded px-3 py-2 text-sm font-medium transition-colors ${
                          pdfMode === "upload_custom_pdf"
                            ? "bg-recoverpe-black text-recoverpe-white"
                            : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
                        }`}
                      >
                        Custom PDF
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
                        Amount only
                      </button>
                    </div>
                  </div>

                  {pdfMode === "generate_tax_invoice" ? (
                    <>
                      <div>
                        <label
                          htmlFor="globalClientGstin"
                          className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                        >
                          Client GSTIN (optional)
                        </label>
                        <Input
                          id="globalClientGstin"
                          value={clientGstin}
                          onChange={(event) =>
                            setClientGstin(event.target.value.toUpperCase())
                          }
                          placeholder="For CGST/SGST vs IGST split"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="globalUpiVpa"
                          className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                        >
                          UPI VPA
                        </label>
                        <Input
                          id="globalUpiVpa"
                          value={upiVpa}
                          onChange={(event) => setUpiVpa(event.target.value.trim())}
                          placeholder="merchant@bank"
                          required
                        />
                      </div>
                    </>
                  ) : pdfMode === "upload_custom_pdf" ? (
                    <div>
                      <label
                        htmlFor="globalCustomPdfFile"
                        className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                      >
                        Custom invoice PDF
                      </label>
                      <input
                        id="globalCustomPdfFile"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) =>
                          setCustomPdfFile(event.target.files?.[0] ?? null)
                        }
                        className="block w-full text-sm text-recoverpe-black file:mr-3 file:rounded-md file:border file:border-recoverpe-grey-light file:bg-recoverpe-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-recoverpe-black"
                        required
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-recoverpe-grey-medium">
                  {mode === "personal"
                    ? "Personal entries do not generate PDF invoices."
                    : "Select a business profile to enable tax invoice generation."}
                </p>
              )}

              {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Give Credit"}
              </Button>
            </form>
          )}
        </div>
      </Modal>

      {successToast ? (
        <Toast
          message={successToast}
          variant="success"
          onClose={() => setSuccessToast(null)}
        />
      ) : null}
    </>
  );
}
