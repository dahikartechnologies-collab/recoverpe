export async function parseApiJsonResponse<T>(
  response: Response
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = (await response.text()).trim().slice(0, 120);

    throw new Error(
      preview.startsWith("<!DOCTYPE") || preview.startsWith("<html")
        ? "Server returned an HTML error page instead of JSON. Check API middleware logs and restart the dev server."
        : `Unexpected non-JSON response (${response.status}).`
    );
  }

  return (await response.json()) as T;
}
