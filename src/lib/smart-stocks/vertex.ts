import {
  GenerateContentResponse,
  Part,
  ResponseSchema,
  VertexAI,
} from "@google-cloud/vertexai";
import { normalizeFirebasePrivateKey } from "@/lib/crypto-env";

export const SMART_STOCKS_GEMINI_MODEL = "gemini-2.5-flash";
export const SMART_STOCKS_VERTEX_LOCATION = "us-central1";

function readVertexProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    ""
  );
}

function readCandidateText(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  return parts
    .map((part) =>
      "text" in part && typeof part.text === "string" ? part.text : ""
    )
    .join("")
    .trim();
}

function getVertexModel(responseSchema: ResponseSchema) {
  const project = readVertexProjectId();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = normalizeFirebasePrivateKey(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );

  if (!project || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured for Vertex AI.");
  }

  const vertex = new VertexAI({
    project,
    location:
      process.env.VERTEX_AI_LOCATION?.trim() || SMART_STOCKS_VERTEX_LOCATION,
    googleAuthOptions: {
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  return vertex.preview.getGenerativeModel({
    model: process.env.GEMINI_MODEL?.trim() || SMART_STOCKS_GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
    },
  });
}

/** Calls Gemini on Vertex with a strict response schema and returns parsed JSON. */
export async function generateStructuredJson(
  responseSchema: ResponseSchema,
  parts: Part[]
): Promise<unknown> {
  const model = getVertexModel(responseSchema);
  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const text = readCandidateText(result.response);

  if (!text) {
    throw new Error("Vertex AI returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Vertex AI did not return valid JSON.");
  }
}
