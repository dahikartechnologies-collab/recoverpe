"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-white px-4 text-[#0A0A0A]">
        <main className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Recoverpe
          </p>
          <h1 className="mt-3 text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            An unexpected error interrupted the application. You can try again,
            or refresh the page.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-xs text-slate-400">
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="focus-ring mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-[#0A0A0A] bg-[#0A0A0A] px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
