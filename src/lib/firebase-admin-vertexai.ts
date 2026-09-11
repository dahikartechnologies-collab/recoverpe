import { GoogleAuth } from "google-auth-library";
import { getAdminAppInstance } from "@/lib/firebase-admin";

const DEFAULT_VERTEX_LOCATION = "global";

function getVertexProjectId(): string {
  const app = getAdminAppInstance();

  return (
    app.options.projectId?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    ""
  );
}

function getVertexLocation(): string {
  return process.env.VERTEX_AI_LOCATION?.trim() || DEFAULT_VERTEX_LOCATION;
}

function getVertexApiHost(location: string): string {
  if (location === "global") {
    return "aiplatform.googleapis.com";
  }

  return `${location}-aiplatform.googleapis.com`;
}

async function getVertexAccessToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured for Vertex AI.");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const accessToken = await auth.getAccessToken();

  if (!accessToken) {
    throw new Error("Failed to obtain Vertex AI access token.");
  }

  return accessToken;
}

async function generateVertexContent(model: string, prompt: string): Promise<string> {
  const projectId = getVertexProjectId();

  if (!projectId) {
    throw new Error("Firebase project ID is not configured for Vertex AI.");
  }

  const location = getVertexLocation();
  const url = `https://${getVertexApiHost(location)}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const accessToken = await getVertexAccessToken();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vertex AI request failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Vertex AI returned an empty response.");
  }

  return text;
}

export function getVertexAI() {
  getAdminAppInstance();

  return {
    getGenerativeModel({ model }: { model: string }) {
      return {
        async generateContent(prompt: string) {
          const text = await generateVertexContent(model, prompt);

          return {
            response: {
              text: () => text,
            },
          };
        },
      };
    },
  };
}
