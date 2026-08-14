"use client";

import Papa from "papaparse";
import { MAX_CSV_FILE_SIZE_BYTES, MAX_CSV_FILE_SIZE_LABEL } from "@/lib/csv-import";

export interface ParsedCsvFile {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
}

export async function parseCsvFile(file: File): Promise<ParsedCsvFile> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.");
  }

  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    throw new Error(`CSV file must be ${MAX_CSV_FILE_SIZE_LABEL}.`);
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields?.filter(Boolean) ?? [];

        if (headers.length === 0) {
          reject(new Error("CSV file has no headers."));
          return;
        }

        const rows = results.data.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").trim().length > 0)
        );

        if (rows.length === 0) {
          reject(new Error("CSV file has no data rows."));
          return;
        }

        resolve({
          headers,
          rows,
          fileName: file.name,
        });
      },
      error: (error) => {
        reject(new Error(error.message || "Failed to parse CSV file."));
      },
    });
  });
}
