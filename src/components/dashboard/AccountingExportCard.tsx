"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import type { Gstr3bSummary } from "@/lib/accounting-export";
import {
  downloadAccountingExport,
  fetchAccountingSummary,
} from "@/lib/accounting-export-client";
import { formatCurrency } from "@/lib/gst";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { useWorkspaceStore } from "@/store/workspace-store";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-recoverpe-black";

/** Indian fiscal year runs 1 April to 31 March, computed in IST. */
function currentFiscalYearStart(): string {
  const today = getTodayDateStringInIst();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const fiscalStartYear = month >= 4 ? year : year - 1;

  return `${fiscalStartYear}-04-01`;
}

function todayInputValue(): string {
  return getTodayDateStringInIst();
}

function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${
        emphasis ? "border-t border-recoverpe-grey-light pt-2 font-medium" : ""
      }`}
    >
      <dt className={emphasis ? "text-recoverpe-black" : "text-recoverpe-grey-medium"}>
        {label}
      </dt>
      <dd className="tabular-nums text-recoverpe-black">{value}</dd>
    </div>
  );
}

export function AccountingExportCard() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const [fromDate, setFromDate] = useState(currentFiscalYearStart);
  const [toDate, setToDate] = useState(todayInputValue);
  const [summary, setSummary] = useState<Gstr3bSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await fetchAccountingSummary(fromDate, toDate);
      setSummary(result.gstr3b);
    } catch (loadError) {
      setSummary(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load accounting summary."
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, mode, activeBusinessId]);

  async function handleDownload(format: "tally_xml" | "csv") {
    setPendingFormat(format);
    setError("");

    try {
      await downloadAccountingExport(format, fromDate, toDate);
      setToast(
        format === "tally_xml"
          ? "Tally XML downloaded. Import it via Gateway of Tally > Import Data."
          : "CSV downloaded."
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download export."
      );
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-recoverpe-black">
          Books &amp; GST summary
        </h2>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Export sales, receipts, and purchase vouchers for your CA, or import
          them straight into Tally Prime.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="export-from" className={LABEL_CLASS}>
              From
            </label>
            <Input
              id="export-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="export-to" className={LABEL_CLASS}>
              To
            </label>
            <Input
              id="export-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-recoverpe-error">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="mt-4 text-sm text-recoverpe-grey-medium">
            Calculating...
          </p>
        ) : summary ? (
          <dl className="mt-4 rounded-md border border-recoverpe-grey-light p-4 text-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              GSTR-3B summary
            </p>
            <SummaryRow
              label="Outward taxable supplies"
              value={formatCurrency(summary.outwardTaxableValue)}
            />
            <SummaryRow
              label="Output tax"
              value={formatCurrency(summary.outwardTotalTax)}
            />
            <SummaryRow
              label="Eligible input tax credit"
              value={formatCurrency(summary.eligibleItcTotal)}
            />
            <SummaryRow
              label={
                summary.netTaxPayable >= 0
                  ? "Net GST payable"
                  : "Credit carried forward"
              }
              value={formatCurrency(Math.abs(summary.netTaxPayable))}
              emphasis
            />
            {summary.tdsWithheld > 0 ? (
              <SummaryRow
                label="TDS withheld"
                value={formatCurrency(summary.tdsWithheld)}
              />
            ) : null}
          </dl>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void handleDownload("tally_xml")}
            disabled={pendingFormat !== null}
          >
            {pendingFormat === "tally_xml"
              ? "Preparing..."
              : "Download Tally XML"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleDownload("csv")}
            disabled={pendingFormat !== null}
          >
            {pendingFormat === "csv" ? "Preparing..." : "Download CSV"}
          </Button>
        </div>

        <p className="mt-3 text-xs text-recoverpe-grey-medium">
          Figures are indicative and derived from the data you have recorded.
          Have your CA verify them before filing.
        </p>
      </CardContent>

      {toast ? (
        <Toast
          message={toast}
          variant="success"
          onClose={() => setToast(null)}
        />
      ) : null}
    </Card>
  );
}
