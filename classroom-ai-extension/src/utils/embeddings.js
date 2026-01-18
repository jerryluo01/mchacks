// Lightweight retrieval helpers.
// Start with keyword-based scoring; optionally add embeddings later.

export function tokenize(q) {
    return String(q || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  }
  
  export function keywordScore(query, text) {
    const words = tokenize(query);
    if (!words.length) return 0;
  
    const hay = String(text || "").toLowerCase();
    let score = 0;
  
    for (const w of words) {
      // count occurrences (cheap-ish)
      let idx = hay.indexOf(w);
      while (idx !== -1) {
        score += 1;
        idx = hay.indexOf(w, idx + w.length);
      }
    }
  
    // tiny boost for exact phrase match
    const q = String(query || "").toLowerCase().trim();
    if (q && hay.includes(q)) score += 4;
  
    return score;
  }
  
  export function topKByKeyword(chunks, query, k = 5) {
    const scored = chunks
      .map((c) => ({
        chunk: c,
        score: keywordScore(query, c.text || ""),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.chunk);
  
    return scored;
  }
  
  // --- Optional embeddings support ---
  // If you later add Gemini embeddings, you can store vectors on chunks and use cosine similarity.
  
  export function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom ? dot / denom : 0;
  }
  
  export function topKByEmbedding(chunks, queryVec, k = 5) {
    const scored = chunks
      .map((c) => ({
        chunk: c,
        score: cosineSim(queryVec, c.embedding),
      }))
      .filter((x) => x.chunk?.embedding && x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.chunk);
  
    return scored;
  }
  