import { create } from "zustand";
import { Business, SubscriptionPlan, WorkspaceMode } from "@/types";

interface WorkspaceState {
  mode: WorkspaceMode;
  activeBusinessId: string | null;
  businesses: Business[];
  isBusinessModalOpen: boolean;
  isLedgerModalOpen: boolean;
  isUpgradeModalOpen: boolean;
  subscriptionPlan: SubscriptionPlan;
  ledgerCount: number;
  ledgerRefreshKey: number;
  walletRefreshKey: number;
  userRefreshKey: number;
  setMode: (mode: WorkspaceMode) => void;
  setActiveBusinessId: (businessId: string | null) => void;
  setBusinesses: (businesses: Business[]) => void;
  setUserBillingState: (subscriptionPlan: SubscriptionPlan, ledgerCount: number) => void;
  addBusiness: (business: Business) => void;
  openBusinessModal: () => void;
  closeBusinessModal: () => void;
  openLedgerModal: () => void;
  closeLedgerModal: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  bumpLedgerRefresh: () => void;
  bumpWalletRefresh: () => void;
  bumpUserRefresh: () => void;
  ghostModeUserId: string | null;
  ghostModeUserEmail: string | null;
  setGhostMode: (userId: string | null, email?: string | null) => void;
  clearGhostMode: () => void;
  activeBusiness: () => Business | null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  mode: "personal",
  activeBusinessId: null,
  businesses: [],
  isBusinessModalOpen: false,
  isLedgerModalOpen: false,
  isUpgradeModalOpen: false,
  subscriptionPlan: "free",
  ledgerCount: 0,
  ledgerRefreshKey: 0,
  walletRefreshKey: 0,
  userRefreshKey: 0,
  ghostModeUserId: null,
  ghostModeUserEmail: null,
  setMode: (mode) => set({ mode }),
  setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
  setBusinesses: (businesses) =>
    set({
      businesses,
      activeBusinessId:
        get().activeBusinessId &&
        businesses.some((business) => business.id === get().activeBusinessId)
          ? get().activeBusinessId
          : businesses[0]?.id ?? null,
    }),
  setUserBillingState: (subscriptionPlan, ledgerCount) =>
    set({ subscriptionPlan, ledgerCount }),
  addBusiness: (business) =>
    set((state) => ({
      businesses: [...state.businesses, business],
      activeBusinessId: business.id,
      mode: "business",
    })),
  openBusinessModal: () => set({ isBusinessModalOpen: true }),
  closeBusinessModal: () => set({ isBusinessModalOpen: false }),
  openLedgerModal: () => set({ isLedgerModalOpen: true }),
  closeLedgerModal: () => set({ isLedgerModalOpen: false }),
  openUpgradeModal: () => set({ isUpgradeModalOpen: true }),
  closeUpgradeModal: () => set({ isUpgradeModalOpen: false }),
  bumpLedgerRefresh: () =>
    set((state) => ({ ledgerRefreshKey: state.ledgerRefreshKey + 1 })),
  bumpWalletRefresh: () =>
    set((state) => ({ walletRefreshKey: state.walletRefreshKey + 1 })),
  bumpUserRefresh: () =>
    set((state) => ({ userRefreshKey: state.userRefreshKey + 1 })),
  setGhostMode: (ghostModeUserId, ghostModeUserEmail = null) =>
    set({ ghostModeUserId, ghostModeUserEmail }),
  clearGhostMode: () => set({ ghostModeUserId: null, ghostModeUserEmail: null }),
  activeBusiness: () => {
    const { businesses, activeBusinessId } = get();
    return businesses.find((business) => business.id === activeBusinessId) ?? null;
  },
}));
