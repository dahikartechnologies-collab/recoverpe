export async function readApiJsonBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    const htmlError = await response.text();
    console.error("API returned HTML instead of JSON. Vercel 500 error:", htmlError);
    throw new Error("Server configuration error. Please check Vercel logs.");
  }

  if (!contentType.includes("application/json")) {
    const preview = (await response.text()).trim().slice(0, 120);

    throw new Error(
      preview
        ? `Unexpected non-JSON response (${response.status}): ${preview}`
        : `Unexpected non-JSON response (${response.status}).`
    );
  }

  return (await response.json()) as T;
}

export async function parseApiJsonResponse<T>(response: Response): Promise<T> {
  const body = await readApiJsonBody<T & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }

  return body as T;
}
