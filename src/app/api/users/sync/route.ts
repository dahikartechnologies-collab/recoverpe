import { NextResponse } from "next/server";
import { getAdminAuth, verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { RecoverpeUser } from "@/types";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");
    const idToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const decodedToken = await verifyFirebaseIdToken(idToken);
    const firebaseUser = await getAdminAuth().getUser(decodedToken.uid);

    if (!firebaseUser.email) {
      return NextResponse.json(
        { error: "Email is required before syncing your account." },
        { status: 400 }
      );
    }

    if (!firebaseUser.phoneNumber) {
      return NextResponse.json(
        { error: "Mobile verification is required before syncing your account." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          firebase_uid: firebaseUser.uid,
          email: firebaseUser.email,
          phone_number: firebaseUser.phoneNumber,
        },
        { onConflict: "firebase_uid" }
      )
      .select(
        "id, firebase_uid, email, phone_number, subscription_plan, vapi_wallet_balance, created_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "This mobile number is already linked to another account. Please log in to that account instead.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message || "Failed to sync user profile." },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: data as RecoverpeUser });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync user profile.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
