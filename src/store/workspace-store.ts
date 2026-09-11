import { create } from "zustand";
import {
  AppRole,
  Business,
  CustomPermissions,
  DEFAULT_CUSTOM_PERMISSIONS,
  SubscriptionPlan,
  WorkspaceMode,
  AccessibleBusinessOption,
} from "@/types";

interface WorkspaceState {
  mode: WorkspaceMode;
  activeBusinessId: string | null;
  businesses: Business[];
  accessibleWorkspaces: AccessibleBusinessOption[];
  workspaceRole: AppRole | null;
  customPermissions: CustomPermissions;
  isWorkspacePermissionsReady: boolean;
  isOwnWorkspaceContext: boolean;
  isBusinessModalOpen: boolean;
  isLedgerModalOpen: boolean;
  ledgerModalTab: "udhaar" | "jama";
  ledgerModalPrefill: {
    contactName: string;
    phoneNumber: string;
  } | null;
  isUpgradeModalOpen: boolean;
  subscriptionPlan: SubscriptionPlan;
  ledgerCount: number;
  isSuperAdmin: boolean;
  ledgerRefreshKey: number;
  walletRefreshKey: number;
  userRefreshKey: number;
  setMode: (mode: WorkspaceMode) => void;
  setActiveBusinessId: (businessId: string | null) => void;
  setBusinesses: (businesses: Business[]) => void;
  setAccessibleWorkspaces: (options: AccessibleBusinessOption[]) => void;
  setWorkspaceRole: (workspaceRole: AppRole | null) => void;
  setCustomPermissions: (customPermissions: CustomPermissions) => void;
  setWorkspacePermissionsReady: (isWorkspacePermissionsReady: boolean) => void;
  setIsOwnWorkspaceContext: (isOwnWorkspaceContext: boolean) => void;
  setUserBillingState: (
    subscriptionPlan: SubscriptionPlan,
    ledgerCount: number,
    isSuperAdmin?: boolean
  ) => void;
  addBusiness: (business: Business) => void;
  openBusinessModal: () => void;
  closeBusinessModal: () => void;
  openLedgerModal: (options?: {
    contactName?: string;
    phoneNumber?: string;
    tab?: "udhaar" | "jama";
  }) => void;
  closeLedgerModal: () => void;
  setLedgerModalTab: (tab: "udhaar" | "jama") => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  bumpLedgerRefresh: () => void;
  bumpWalletRefresh: () => void;
  bumpUserRefresh: () => void;
  ghostModeUserId: string | null;
  ghostModeUserEmail: string | null;
  viewLedgerId: string | null;
  setViewLedgerId: (ledgerId: string | null) => void;
  setGhostMode: (userId: string | null, email?: string | null) => void;
  clearGhostMode: () => void;
  activeBusiness: () => Business | null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  mode: "personal",
  activeBusinessId: null,
  businesses: [],
  accessibleWorkspaces: [],
  workspaceRole: null,
  customPermissions: DEFAULT_CUSTOM_PERMISSIONS,
  isWorkspacePermissionsReady: false,
  isOwnWorkspaceContext: false,
  isBusinessModalOpen: false,
  isLedgerModalOpen: false,
  ledgerModalTab: "udhaar",
  ledgerModalPrefill: null,
  isUpgradeModalOpen: false,
  subscriptionPlan: "free",
  ledgerCount: 0,
  isSuperAdmin: false,
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
  setAccessibleWorkspaces: (accessibleWorkspaces) =>
    set({ accessibleWorkspaces }),
  setWorkspaceRole: (workspaceRole) => set({ workspaceRole }),
  setCustomPermissions: (customPermissions) => set({ customPermissions }),
  setWorkspacePermissionsReady: (isWorkspacePermissionsReady) =>
    set({ isWorkspacePermissionsReady }),
  setIsOwnWorkspaceContext: (isOwnWorkspaceContext) => set({ isOwnWorkspaceContext }),
  setUserBillingState: (subscriptionPlan, ledgerCount, isSuperAdmin = false) =>
    set({ subscriptionPlan, ledgerCount, isSuperAdmin }),
  addBusiness: (business) =>
    set((state) => ({
      businesses: [...state.businesses, business],
      activeBusinessId: business.id,
      mode: "business",
    })),
  openBusinessModal: () => set({ isBusinessModalOpen: true }),
  closeBusinessModal: () => set({ isBusinessModalOpen: false }),
  openLedgerModal: (options) =>
    set({
      isLedgerModalOpen: true,
      ledgerModalTab: options?.tab ?? "udhaar",
      ledgerModalPrefill:
        options?.contactName && options?.phoneNumber
          ? {
              contactName: options.contactName,
              phoneNumber: options.phoneNumber,
            }
          : null,
    }),
  closeLedgerModal: () =>
    set({
      isLedgerModalOpen: false,
      ledgerModalPrefill: null,
      ledgerModalTab: "udhaar",
    }),
  setLedgerModalTab: (ledgerModalTab) => set({ ledgerModalTab }),
  openUpgradeModal: () => set({ isUpgradeModalOpen: true }),
  closeUpgradeModal: () => set({ isUpgradeModalOpen: false }),
  bumpLedgerRefresh: () =>
    set((state) => ({ ledgerRefreshKey: state.ledgerRefreshKey + 1 })),
  bumpWalletRefresh: () =>
    set((state) => ({ walletRefreshKey: state.walletRefreshKey + 1 })),
  bumpUserRefresh: () =>
    set((state) => ({ userRefreshKey: state.userRefreshKey + 1 })),
  viewLedgerId: null,
  setViewLedgerId: (viewLedgerId) => set({ viewLedgerId }),
  setGhostMode: (ghostModeUserId, ghostModeUserEmail = null) =>
    set({ ghostModeUserId, ghostModeUserEmail }),
  clearGhostMode: () => set({ ghostModeUserId: null, ghostModeUserEmail: null }),
  activeBusiness: () => {
    const { businesses, activeBusinessId } = get();
    return businesses.find((business) => business.id === activeBusinessId) ?? null;
  },
}));
