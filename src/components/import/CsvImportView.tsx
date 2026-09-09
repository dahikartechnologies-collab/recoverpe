"use client";

import { useMemo, useState } from "react";
import { ColumnMappingForm } from "@/components/import/ColumnMappingForm";
import { CsvDropZone } from "@/components/import/CsvDropZone";
import { ImportGuideCard } from "@/components/import/ImportGuideCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { parseCsvFile } from "@/lib/csv-parse-client";
import {
  guessColumnMapping,
  ImportFieldKey,
  isMappingComplete,
  transformCsvRows,
} from "@/lib/csv-import";
import { BatchUpgradeRequiredError, importLedgerBatchChunked } from "@/lib/ledger-batch-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { MappedImportRow } from "@/types";

interface ToastState {
  message: string;
  variant: "success" | "error";
}

export function CsvImportView() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const bumpLedgerRefresh = useWorkspaceStore((state) => state.bumpLedgerRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const openUpgradeModal = useWorkspaceStore((state) => state.openUpgradeModal);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>(
    {}
  );
  const [parseError, setParseError] = useState("");
  const [importError, setImportError] = useState("");
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const mappingComplete = isMappingComplete(mapping);

  const preview = useMemo(() => {
    if (!mappingComplete) {
      return { validRows: [] as MappedImportRow[], errors: [] as string[] };
    }

    return transformCsvRows(rawRows, mapping);
  }, [mapping, mappingComplete, rawRows]);

  async function handleFileSelected(file: File) {
    setIsParsing(true);
    setParseError("");
    setImportError("");
    setRowErrors([]);
    setToast(null);

    try {
      const parsed = await parseCsvFile(file);
      const guessedMapping = guessColumnMapping(parsed.headers);

      setFileName(parsed.fileName);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(guessedMapping);
    } catch (error) {
      setFileName(null);
      setHeaders([]);
      setRawRows([]);
      setMapping({});
      setParseError(
        error instanceof Error ? error.message : "Failed to parse CSV file."
      );
    } finally {
      setIsParsing(false);
    }
  }

  function handleMappingChange(field: ImportFieldKey, header: string) {
    setMapping((current) => ({
      ...current,
      [field]: header,
    }));
    setImportError("");
    setRowErrors([]);
  }

  function handleReset() {
    setFileName(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setParseError("");
    setImportError("");
    setRowErrors([]);
    setToast(null);
  }

  async function handleImport() {
    if (!mappingComplete) {
      setImportError("Complete all column mappings before importing.");
      return;
    }

    const { validRows, errors } = transformCsvRows(rawRows, mapping);

    if (validRows.length === 0) {
      setRowErrors(errors.slice(0, 5));
      setImportError("No valid rows found to import.");
      return;
    }

    if (mode === "business" && !activeBusinessId) {
      setImportError("Select a business profile before importing business ledgers.");
      return;
    }

    setIsImporting(true);
    setImportError("");
    setRowErrors(errors.slice(0, 5));
    setToast(null);

    try {
      const result = await importLedgerBatchChunked({
        rows: validRows,
        workspace_mode: mode,
        business_id: mode === "business" ? activeBusinessId : null,
      });

      bumpLedgerRefresh();
      bumpUserRefresh();

      const skippedMessage =
        errors.length > 0 ? ` ${errors.length} row(s) skipped due to validation.` : "";

      setToast({
        message: `${result.imported_count} invoice(s) imported successfully.${skippedMessage}`,
        variant: "success",
      });

      handleReset();
    } catch (error) {
      if (error instanceof BatchUpgradeRequiredError) {
        openUpgradeModal();
        setImportError(error.message);
        setToast({
          message: error.message,
          variant: "error",
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to import CSV batch.";

      setImportError(message);
      setToast({
        message,
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Bulk CSV Import</h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Upload Tally or Excel CSV exports, map your columns, and import receivables
          into {mode === "business" ? "your active business workspace" : "Personal mode"}.
        </p>
      </div>

      {!fileName ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <ImportGuideCard />
          <CsvDropZone onFileSelected={handleFileSelected} isProcessing={isParsing} />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-recoverpe-black">{fileName}</p>
                <p className="mt-1 text-sm text-recoverpe-grey-medium">
                  {rawRows.length} row(s) detected
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={handleReset}>
                Choose another file
              </Button>
            </CardContent>
          </Card>

          <ColumnMappingForm
            headers={headers}
            mapping={mapping}
            onChange={handleMappingChange}
          />

          {mappingComplete ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-medium text-recoverpe-black">Import preview</p>
                <p className="text-sm text-recoverpe-grey-medium">
                  {preview.validRows.length} valid row(s) ready to import.
                  {preview.errors.length > 0
                    ? ` ${preview.errors.length} row(s) will be skipped.`
                    : ""}
                </p>
                <div className="overflow-x-auto rounded-md border border-recoverpe-grey-light">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light">
                        <th className="px-3 py-2 font-medium">Contact</th>
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.validRows.slice(0, 5).map((row, index) => (
                        <tr
                          key={`${row.phone_number}-${index}`}
                          className="border-b border-recoverpe-grey-light last:border-b-0"
                        >
                          <td className="px-3 py-2">{row.contact_name}</td>
                          <td className="px-3 py-2 tabular-nums">{row.phone_number}</td>
                          <td className="px-3 py-2 tabular-nums">{row.amount}</td>
                          <td className="px-3 py-2 tabular-nums">{row.due_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {rowErrors.length > 0 ? (
            <div className="rounded-md border border-recoverpe-grey-light px-4 py-3">
              <p className="text-sm font-medium text-recoverpe-black">Row issues</p>
              <ul className="mt-2 space-y-1 text-sm text-recoverpe-error">
                {rowErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {importError ? (
            <p className="text-sm text-recoverpe-error">{importError}</p>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={!mappingComplete || isImporting}
            >
              {isImporting ? "Importing..." : "Import rows"}
            </Button>
          </div>
        </div>
      )}

      {parseError ? <p className="text-sm text-recoverpe-error">{parseError}</p> : null}

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
