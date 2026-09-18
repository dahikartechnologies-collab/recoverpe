"use client";

import { useCallback, useEffect, useState } from "react";
import { parseAgentTab, type AgentTab } from "@/lib/agent/tab-state";

function readTabFromLocation(): AgentTab {
  if (typeof window === "undefined") {
    return "performance";
  }

  const hash = window.location.hash.replace("#", "");
  return parseAgentTab(hash || "performance");
}

export function useAgentTab() {
  const [activeTab, setActiveTab] = useState<AgentTab>("performance");

  useEffect(() => {
    function syncTabFromHash() {
      setActiveTab(readTabFromLocation());
    }

    if (!window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#performance`
      );
      setActiveTab("performance");
    } else {
      syncTabFromHash();
    }

    window.addEventListener("hashchange", syncTabFromHash);
    window.addEventListener("popstate", syncTabFromHash);

    return () => {
      window.removeEventListener("hashchange", syncTabFromHash);
      window.removeEventListener("popstate", syncTabFromHash);
    };
  }, []);

  const navigateToTab = useCallback((tab: AgentTab) => {
    const nextHash = `#${tab}`;

    if (window.location.hash !== nextHash) {
      window.location.hash = tab;
    }

    setActiveTab(tab);
  }, []);

  return { activeTab, navigateToTab };
}
