import { DebtorPortalClient } from "@/components/portal/DebtorPortalClient";
import { fetchDebtorPortalView } from "@/lib/portal-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface DebtorPortalPageProps {
  params: { token: string };
}

export default async function DebtorPortalPage({ params }: DebtorPortalPageProps) {
  const supabase = createAdminSupabaseClient();
  const view = await fetchDebtorPortalView(supabase, params.token);

  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-recoverpe-white px-4">
        <div className="w-full max-w-md rounded-lg border border-recoverpe-grey-light px-6 py-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-recoverpe-grey-medium">
            Recoverpe Portal
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-recoverpe-black">
            Link Expired
          </h1>
          <p className="mt-3 text-sm leading-6 text-recoverpe-grey-medium">
            This secure portal link is invalid or has expired. Please contact the
            merchant for a fresh statement link.
          </p>
        </div>
      </div>
    );
  }

  return <DebtorPortalClient view={view} />;
}
