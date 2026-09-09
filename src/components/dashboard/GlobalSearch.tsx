"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Search, Users } from "lucide-react";
import { searchWorkspace } from "@/lib/vendor-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { WorkspaceSearchResult } from "@/types";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

export function GlobalSearch() {
  const router = useRouter();
  const setViewLedgerId = useWorkspaceStore((state) => state.setViewLedgerId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setError("");
      setIsSearching(false);
      return;
    }

    let cancelled = false;

    async function runSearch() {
      setIsSearching(true);
      setError("");

      try {
        const response = await searchWorkspace(debouncedQuery.trim());

        if (!cancelled) {
          setResults(response.results);
          setIsOpen(true);
        }
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Search failed."
          );
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const contactResults = results.filter((result) => result.type === "Contact");
  const ledgerResults = results.filter((result) => result.type === "Ledger");

  function handleSelect(result: WorkspaceSearchResult) {
    setQuery("");
    setResults([]);
    setIsOpen(false);

    if (result.type === "Contact") {
      router.push(`/dashboard/vendors/${result.id}`);
      return;
    }

    if (result.contact_id) {
      router.push(
        `/dashboard/vendors/${result.contact_id}?ledger=${result.id}`
      );
      return;
    }

    setViewLedgerId(result.id);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-recoverpe-grey-medium" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="Search vendors, invoices, amounts..."
          className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white py-2.5 pl-10 pr-3 text-sm text-recoverpe-black outline-none transition-colors placeholder:text-recoverpe-grey-medium focus:border-recoverpe-black"
          aria-label="Search workspace"
        />
      </div>

      {isOpen && (query.trim().length >= 2 || isSearching || error) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-md border border-recoverpe-grey-light bg-recoverpe-white shadow-sm">
          {isSearching ? (
            <p className="px-4 py-3 text-sm text-recoverpe-grey-medium">
              Searching...
            </p>
          ) : null}

          {error ? (
            <p className="px-4 py-3 text-sm text-recoverpe-error">{error}</p>
          ) : null}

          {!isSearching && !error && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-recoverpe-grey-medium">
              No matches found.
            </p>
          ) : null}

          {!isSearching && !error && contactResults.length > 0 ? (
            <div className="border-b border-recoverpe-grey-light">
              <p className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                <Users className="h-3.5 w-3.5" />
                Found {contactResults.length} Contact
                {contactResults.length === 1 ? "" : "s"}
              </p>
              <ul>
                {contactResults.map((result) => (
                  <li key={`contact-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(result)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-recoverpe-grey-light"
                    >
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-recoverpe-black" />
                      <span>
                        <span className="block text-sm font-medium text-recoverpe-black">
                          {result.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-recoverpe-grey-medium">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!isSearching && !error && ledgerResults.length > 0 ? (
            <div>
              <p className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                <FileText className="h-3.5 w-3.5" />
                Found {ledgerResults.length} Ledger
                {ledgerResults.length === 1 ? "" : "s"}
              </p>
              <ul>
                {ledgerResults.map((result) => (
                  <li key={`ledger-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(result)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-recoverpe-grey-light"
                    >
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-recoverpe-black" />
                      <span>
                        <span className="block text-sm font-medium text-recoverpe-black">
                          {result.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-recoverpe-grey-medium">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
