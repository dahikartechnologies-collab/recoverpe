import { ContactDirectoryEntry } from "@/types";

function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function vendorsToCsv(contacts: ContactDirectoryEntry[]): string {
  const header = [
    "Vendor",
    "Phone",
    "Open Invoices",
    "Net Outstanding",
    "90+ Days",
  ];

  const rows = contacts.map((contact) => [
    escapeCsvValue(contact.contact_name),
    escapeCsvValue(contact.phone_number),
    escapeCsvValue(contact.open_invoice_count),
    escapeCsvValue(contact.net_outstanding),
    escapeCsvValue(contact.bucket_90_plus),
  ]);

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadVendorsCsv(
  contacts: ContactDirectoryEntry[],
  filename: string
): void {
  const csv = vendorsToCsv(contacts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
