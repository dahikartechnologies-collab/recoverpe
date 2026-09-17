import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`min-w-full text-left text-sm ${className}`}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-[var(--rp-fill)]/80 ${className}`} {...props} />
  );
}

export function TableBody({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-recoverpe-line ${className}`} {...props} />
  );
}

export function TableRow({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`rp-interactive hover:bg-recoverpe-fill/60 ${className}`}
      {...props}
    />
  );
}

export function TableHead({
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`type-table-header px-4 py-2.5 text-left ${className}`}
      {...props}
    />
  );
}

export function TableCell({
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle ${className}`} {...props} />;
}
