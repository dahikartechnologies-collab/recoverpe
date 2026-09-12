import { GoogleAuth } from "google-auth-library";
import { getAdminAppInstance } from "@/lib/firebase-admin";

const DEFAULT_VERTEX_LOCATION = "global";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// Read per request so a model ID can be swapped from the Vercel dashboard
// without shipping a deploy.
export function getDefaultGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

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

export interface VertexInlineData {
  mimeType: string;
  data: string;
}

export type VertexPart = { text: string } | { inlineData: VertexInlineData };

export type VertexPromptInput = string | VertexPart[];

export interface VertexGenerationConfig {
  responseMimeType?: string;
  temperature?: number;
  systemInstruction?: string;
}

function toRequestParts(prompt: VertexPromptInput) {
  const parts = typeof prompt === "string" ? [{ text: prompt }] : prompt;

  return parts.map((part) =>
    "inlineData" in part
      ? {
          inline_data: {
            mime_type: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        }
      : { text: part.text }
  );
}

async function generateVertexContent(
  model: string,
  prompt: VertexPromptInput,
  generationConfig?: VertexGenerationConfig
): Promise<string> {
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
      ...(generationConfig?.systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: generationConfig.systemInstruction }],
            },
          }
        : {}),
      contents: [
        {
          role: "user",
          parts: toRequestParts(prompt),
        },
      ],
      ...(generationConfig?.responseMimeType ||
      generationConfig?.temperature !== undefined
        ? {
            generationConfig: {
              ...(generationConfig.responseMimeType
                ? { responseMimeType: generationConfig.responseMimeType }
                : {}),
              ...(generationConfig.temperature !== undefined
                ? { temperature: generationConfig.temperature }
                : {}),
            },
          }
        : {}),
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
        async generateContent(
          prompt: VertexPromptInput,
          generationConfig?: VertexGenerationConfig
        ) {
          const text = await generateVertexContent(
            model,
            prompt,
            generationConfig
          );

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
