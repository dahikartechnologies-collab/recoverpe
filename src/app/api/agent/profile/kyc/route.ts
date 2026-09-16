import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { uploadAgentKycSide } from "@/lib/agent/profile";
import type { KycDocumentSide } from "@/lib/agent/kyc-storage";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sideRaw = formData.get("side");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "KYC document file is required." }, { status: 400 });
    }

    const side = sideRaw === "back" ? "back" : sideRaw === "front" ? "front" : null;

    if (!side) {
      return NextResponse.json(
        { error: 'Upload side must be "front" or "back".' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const contentType = (file.type || "application/octet-stream").trim().toLowerCase();

    const supabase = createAdminSupabaseClient();
    const profile = await uploadAgentKycSide(
      supabase,
      agent.agentId,
      side as KycDocumentSide,
      {
        fileName: file.name || `${side}.jpg`,
        fileBuffer,
        contentType,
      }
    );

    return NextResponse.json({ profile });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload KYC document.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
