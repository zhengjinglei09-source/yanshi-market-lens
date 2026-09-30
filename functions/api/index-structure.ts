import { FUYAO_INDEX_URL, parseIndexSnapshot } from "../../lib/fuyao-index";

type Context = { env: Record<string, unknown> };

export async function onRequestGet({ env }: Context): Promise<Response> {
  const key = env.HITHINK_FINANCE_API_KEY;
  if (typeof key !== "string" || !key) {
    return Response.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(FUYAO_INDEX_URL, {
      headers: { "X-api-key": key },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("provider_http_error");
    const evidence = parseIndexSnapshot(await response.json());
    return Response.json(
      { available: true, evidence },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return Response.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
