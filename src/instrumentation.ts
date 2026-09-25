import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Must stay an if-block around the import: this file is also bundled for the
  // edge runtime, and only a constant-false branch keeps Node-only modules
  // (crypto, Prisma) out of that bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportError } = await import("@/lib/error-report");
    // routePath is the file pattern (/reset-password/[token]); request.path
    // would carry the real token into the email.
    await reportError(err, `Server ${context.routeType} ${context.routePath}`, {
      method: request.method,
      digest: typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
    });
  }
};
