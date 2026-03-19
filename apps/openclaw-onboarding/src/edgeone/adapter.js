import { dispatch } from "../api/router.js";
import { KvRepository } from "../store/kv-repo.js";
import { fail } from "../utils/http.js";

function headersToObject(headers) {
  const output = {};
  for (const [key, value] of headers.entries()) {
    output[key] = value;
  }
  return output;
}

function resolveKvBinding(context) {
  return (
    context.env?.ONBOARDING_KV ??
    context.ONBOARDING_KV ??
    globalThis.ONBOARDING_KV ??
    null
  );
}

export async function dispatchEdgeOne(context, forcedPath = null) {
  try {
    const request = context.request;
    const method = request.method;
    const path = forcedPath ?? new URL(request.url).pathname;
    const headers = headersToObject(request.headers);
    const body =
      method === "GET" || method === "HEAD" ? null : await request.text();
    const kvBinding = resolveKvBinding(context);

    if (!kvBinding) {
      const response = fail(
        503,
        "SERVICE_MISCONFIGURED",
        "Missing ONBOARDING_KV binding",
      );
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    const response = await dispatch(
      {
        method,
        path,
        headers,
        body,
        edgeoneContext: context,
      },
      {
        repo: new KvRepository(kvBinding),
      },
    );

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    const response = fail(
      500,
      "EDGE_RUNTIME_ERROR",
      error instanceof Error ? error.message : "Unknown edge runtime error",
    );
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }
}
