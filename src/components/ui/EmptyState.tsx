"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-recoverpe-grey-light bg-recoverpe-grey-light text-recoverpe-grey-medium">
          {icon}
        </div>
      ) : (
        <div className="mb-4 h-12 w-12 rounded-full border border-dashed border-recoverpe-grey-light" />
      )}
      <p className="text-sm font-medium text-recoverpe-black">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-recoverpe-grey-medium">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
