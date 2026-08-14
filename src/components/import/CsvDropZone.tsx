"use client";

import { DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  MAX_CSV_FILE_SIZE_BYTES,
  MAX_CSV_FILE_SIZE_LABEL,
} from "@/lib/csv-import";

interface CsvDropZoneProps {
  onFileSelected: (file: File) => void;
  isProcessing?: boolean;
}

export function CsvDropZone({
  onFileSelected,
  isProcessing = false,
}: CsvDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  function validateAndSelect(file: File) {
    setLocalError("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setLocalError("Please upload a .csv file.");
      return;
    }

    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      setLocalError(`File exceeds the ${MAX_CSV_FILE_SIZE_LABEL} limit.`);
      return;
    }

    onFileSelected(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? "border-recoverpe-black bg-recoverpe-grey-light"
            : "border-recoverpe-grey-light bg-recoverpe-white"
        }`}
      >
        <p className="text-sm font-medium text-recoverpe-black">
          Drag and drop your CSV export here
        </p>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Tally and Excel CSV files supported. {MAX_CSV_FILE_SIZE_LABEL}.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isProcessing}
            onClick={() => inputRef.current?.click()}
          >
            {isProcessing ? "Parsing..." : "Browse CSV"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              validateAndSelect(file);
            }
            event.target.value = "";
          }}
        />
      </div>
      {localError ? <p className="text-sm text-recoverpe-error">{localError}</p> : null}
    </div>
  );
}
