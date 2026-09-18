import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import {
  parseAgentKycDocuments,
  type KycDocumentSide,
} from "@/lib/agent/kyc-storage";
import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function parseKycSide(value: string | null): KycDocumentSide | null {
  if (value === "front" || value === "back") {
    return value;
  }

  return null;
}

export async function GET(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const side = parseKycSide(searchParams.get("side"));

    if (!side) {
      return NextResponse.json(
        { error: "Invalid document side. Use front or back." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("agents")
      .select("kyc_document_url")
      .eq("id", agent.agentId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Agent profile not found." }, { status: 404 });
    }

    const documents = parseAgentKycDocuments(
      profile.kyc_document_url as string | null | undefined
    );
    const storagePath = documents[side];

    if (!storagePath) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const signedUrl = await createShortLivedSignedUrl(storagePath);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open KYC document.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
