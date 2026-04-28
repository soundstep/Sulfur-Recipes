interface Env {
  WORKER_URL: string; // Pages env var pointing at the Worker
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const path = (params["path"] as string[]).join("/");
  const workerUrl = `${env.WORKER_URL}/api/${path}`;

  const url = new URL(request.url);
  const targetUrl = `${workerUrl}${url.search}`;

  // Forward the request to the Worker
  const workerResponse = await fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined,
  });

  return workerResponse;
};
