"use client";

interface GstExemptionCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function GstExemptionCheckbox({
  id = "gst-not-required",
  checked,
  onChange,
  disabled = false,
}: GstExemptionCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-recoverpe-line bg-recoverpe-white px-3 py-3"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-recoverpe-black"
      />
      <span>
        <span className="block text-sm font-medium text-recoverpe-black">
          My business is not registered for GST
        </span>
        <span className="mt-0.5 block text-xs text-recoverpe-muted">
          Use this if GST registration is not required or not completed. You can add a
          GSTIN later. Invoices will export as a Bill of Supply.
        </span>
      </span>
    </label>
  );
}
