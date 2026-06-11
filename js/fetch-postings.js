function uniqueUrls(urls) {
  return urls.filter((url, index, all) => all.indexOf(url) === index);
}

export async function fetchPostings() {
  const pageUrl = new URL(window.location.href);
  const pageDir = new URL("./", pageUrl);
  const base = import.meta.env?.BASE_URL || "/";
  const baseUrl = new URL(base, pageUrl.origin);

  const candidates = uniqueUrls([
    // Built bundle lives in /assets/*.js — postings.json is one level up at site root.
    new URL("../postings.json", import.meta.url).href,
    new URL("postings.json", pageDir).href,
    new URL("./postings.json", pageDir).href,
    new URL("postings.json", baseUrl).href,
    new URL("/postings.json", pageUrl.origin).href,
    new URL("public/postings.json", pageDir).href,
  ]);

  let lastError;

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const payload = await response.json();
      if (Array.isArray(payload?.data) && payload.data.length > 0) {
        return payload;
      }

      lastError = new Error(`Invalid postings payload from ${url}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to fetch jobs");
}
