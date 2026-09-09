"use client";

import {
  IMPORT_FIELD_LABELS,
  ImportFieldKey,
  OPTIONAL_IMPORT_FIELDS,
  REQUIRED_IMPORT_FIELDS,
} from "@/lib/csv-import";

interface ColumnMappingFormProps {
  headers: string[];
  mapping: Partial<Record<ImportFieldKey, string>>;
  onChange: (field: ImportFieldKey, header: string) => void;
}

export function ColumnMappingForm({
  headers,
  mapping,
  onChange,
}: ColumnMappingFormProps) {
  return (
    <div className="space-y-4 rounded-lg border border-recoverpe-grey-light">
      <div className="border-b border-recoverpe-grey-light px-4 py-3">
        <p className="text-sm font-medium text-recoverpe-black">Column mapping</p>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Match your CSV headers to Recoverpe fields. Phone Number is required for
          WhatsApp and AI reminders.
        </p>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {REQUIRED_IMPORT_FIELDS.map((field) => (
          <div key={field}>
            <label
              htmlFor={`map-${field}`}
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              {IMPORT_FIELD_LABELS[field]}
            </label>
            <select
              id={`map-${field}`}
              value={mapping[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
              className="w-full min-h-11 rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black outline-none focus:border-recoverpe-black"
            >
              <option value="">Select a column</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}

        {OPTIONAL_IMPORT_FIELDS.map((field) => (
          <div key={field}>
            <label
              htmlFor={`map-${field}`}
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              {IMPORT_FIELD_LABELS[field]} (optional)
            </label>
            <select
              id={`map-${field}`}
              value={mapping[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
              className="w-full min-h-11 rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black outline-none focus:border-recoverpe-black"
            >
              <option value="">Skip this field</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-recoverpe-grey-medium">
              Map invoice numbers to update existing rows instead of creating
              duplicates during import.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
