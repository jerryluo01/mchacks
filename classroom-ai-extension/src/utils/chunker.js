// Very simple chunker for hackathon RAG.
// - Splits on paragraphs first, then falls back to slicing long paragraphs.
// - Uses char-based sizes to avoid needing tokenizers.

export function normalizeText(text) {
    if (!text) return "";
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  
  export function chunkText(text, opts = {}) {
    const {
      maxChars = 1800, // ~300-500 tokens depending on language
      minChars = 250,
      hardMaxChars = 2400,
    } = opts;
  
    const clean = normalizeText(text);
    if (!clean) return [];
  
    const paras = clean.split("\n\n").map((p) => p.trim()).filter(Boolean);
  
    const chunks = [];
    let buf = "";
  
    function pushBuf() {
      const t = buf.trim();
      if (t) chunks.push(t);
      buf = "";
    }
  
    for (const p of paras) {
      // If adding this paragraph would overflow, flush buffer first
      if (buf.length && buf.length + 2 + p.length > maxChars) pushBuf();
  
      // If paragraph is huge, slice it
      if (p.length > hardMaxChars) {
        // flush any existing buffer
        if (buf.length) pushBuf();
  
        for (let i = 0; i < p.length; i += maxChars) {
          chunks.push(p.slice(i, i + maxChars).trim());
        }
        continue;
      }
  
      // Otherwise append
      buf = buf ? `${buf}\n\n${p}` : p;
  
      // If buffer is now long enough, push it (optional behavior)
      if (buf.length >= maxChars) pushBuf();
    }
  
    if (buf.length) pushBuf();
  
    // Post-filter very tiny chunks by merging
    const merged = [];
    for (const c of chunks) {
      if (merged.length === 0) {
        merged.push(c);
        continue;
      }
      if (c.length < minChars) {
        merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${c}`;
      } else {
        merged.push(c);
      }
    }
  
    return merged;
  }
  
  export function makeChunkObjects({
    courseId,
    sourceId,
    title,
    text,
    extraMeta = {},
    chunkOpts = {},
  }) {
    const chunks = chunkText(text, chunkOpts);
    return chunks.map((chunk, idx) => ({
      id: `${courseId}::${sourceId}::${idx}`,
      courseId,
      sourceId,
      title: title || "Untitled",
      chunkIndex: idx,
      text: chunk,
      ...extraMeta,
    }));
  }
  