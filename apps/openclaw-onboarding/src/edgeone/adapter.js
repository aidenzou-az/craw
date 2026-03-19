import { dispatch } from "../api/router.js";
import { KvRepository } from "../store/kv-repo.js";

function headersToObject(headers) {
  const output = {};
  for (const [key, value] of headers.entries()) {
    output[key] = value;
  }
  return output;
}

export async function dispatchEdgeOne(context, forcedPath = null) {
  const request = context.request;
  const method = request.method;
  const path = forcedPath ?? new URL(request.url).pathname;
  const headers = headersToObject(request.headers);
  const body =
    method === "GET" || method === "HEAD" ? null : await request.text();

  const response = await dispatch({
    method,
    path,
    headers,
    body,
    edgeoneContext: context,
  }, {
    repo: new KvRepository(context.env?.ONBOARDING_KV),
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
