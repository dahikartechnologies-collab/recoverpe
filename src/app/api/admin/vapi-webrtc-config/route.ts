import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { resolveVapiWebRtcConfig } from "@/lib/vapi-webrtc-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const config = resolveVapiWebRtcConfig();

    if (!config.isConfigured) {
      return NextResponse.json(
        {
          error:
            "WebRTC dialer is not configured. Set VAPI_PUBLIC_KEY (or NEXT_PUBLIC_VAPI_PUBLIC_KEY) and VAPI_ASSISTANT_ID (or NEXT_PUBLIC_VAPI_ASSISTANT_ID) in Vercel.",
          publicKey: "",
          assistantId: "",
          isConfigured: false,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      publicKey: config.publicKey,
      assistantId: config.assistantId,
      isConfigured: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load VAPI WebRTC configuration.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
