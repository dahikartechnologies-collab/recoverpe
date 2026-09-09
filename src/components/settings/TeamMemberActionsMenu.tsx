"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { WorkspaceMember } from "@/types";

interface TeamMemberActionsMenuProps {
  member: WorkspaceMember;
  onEdit: (member: WorkspaceMember) => void;
  onRemove: (member: WorkspaceMember) => void;
}

export function TeamMemberActionsMenu({
  member,
  onEdit,
  onRemove,
}: TeamMemberActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label="Team member actions"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-recoverpe-grey-light text-recoverpe-black hover:bg-recoverpe-grey-light/60"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-recoverpe-grey-light bg-recoverpe-white py-1">
          <button
            type="button"
            onClick={() => {
              onEdit(member);
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-recoverpe-black hover:bg-recoverpe-grey-light/60"
          >
            <Pencil className="h-4 w-4" />
            Edit role
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove(member);
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-recoverpe-error hover:bg-recoverpe-grey-light/60"
          >
            <Trash2 className="h-4 w-4" />
            Remove user
          </button>
        </div>
      ) : null}
    </div>
  );
}
