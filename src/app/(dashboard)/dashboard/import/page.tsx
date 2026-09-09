import { CsvImportView } from "@/components/import/CsvImportView";
import { enforceOwnerWorkspaceRoute } from "@/lib/server/partner-route-guard";

export default function ImportPage() {
  enforceOwnerWorkspaceRoute();

  return <CsvImportView />;
}
