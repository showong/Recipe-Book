const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchTavily(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<TavilyResult[]> {
  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.results ?? []) as TavilyResult[];
}

export async function multiSearchTavily(
  queries: string[],
  apiKey: string,
): Promise<TavilyResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchTavily(q, apiKey, 3).catch(() => [] as TavilyResult[])),
  );
  const seen = new Set<string>();
  return results.flat().filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
