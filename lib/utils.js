import crypto from "crypto";
import path from "path";

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate hash for file content to detect changes
 */
export function hashContent(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Intelligent chunking: tries to split by function/class boundaries
 */
export function smartChunk(content, file, config) {
  const lines = content.split("\n");
  const chunks = [];
  const ext = path.extname(file);
  
  // Language-specific patterns for function/class detection
  const patterns = {
    // JavaScript/TypeScript
    js: /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+\w+/,
    jsx: /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+\w+/,
    ts: /^(export\s+)?(async\s+)?(function|class|const|let|var|interface|type)\s+\w+/,
    tsx: /^(export\s+)?(async\s+)?(function|class|const|let|var|interface|type)\s+\w+/,
    mjs: /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+\w+/,
    cjs: /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+\w+/,
    
    // Python
    py: /^(class|def|async\s+def)\s+\w+/,
    pyw: /^(class|def|async\s+def)\s+\w+/,
    
    // Java/Kotlin/Scala
    java: /^(public|private|protected)?\s*(static\s+)?(class|interface|enum|void|int|String|boolean)\s+\w+/,
    kt: /^(class|interface|object|fun|val|var)\s+\w+/,
    kts: /^(class|interface|object|fun|val|var)\s+\w+/,
    scala: /^(class|object|trait|def|val|var)\s+\w+/,
    
    // C/C++
    c: /^(struct|enum|union|void|int|char|float|double)\s+\w+/,
    cpp: /^(class|struct|namespace|template|void|int|bool)\s+\w+/,
    cc: /^(class|struct|namespace|template|void|int|bool)\s+\w+/,
    cxx: /^(class|struct|namespace|template|void|int|bool)\s+\w+/,
    h: /^(class|struct|namespace|template|void|int|bool)\s+\w+/,
    hpp: /^(class|struct|namespace|template|void|int|bool)\s+\w+/,
    
    // C#
    cs: /^(public|private|protected)?\s*(static\s+)?(class|interface|struct|enum|void|int|string|bool)\s+\w+/,
    
    // Go
    go: /^(func|type|const|var)\s+\w+/,
    
    // Rust
    rs: /^(pub\s+)?(fn|struct|enum|trait|impl|const|static)\s+\w+/,
    
    // PHP
    php: /^(class|interface|trait|function|const)\s+\w+/,
    
    // Ruby
    rb: /^(class|module|def)\s+\w+/,
    rake: /^(class|module|def|task)\s+\w+/,
    
    // Swift
    swift: /^(class|struct|enum|protocol|func|var|let)\s+\w+/,
    
    // R
    r: /^(\w+)\s*<-\s*function/,
    R: /^(\w+)\s*<-\s*function/,
    
    // Lua
    lua: /^(function|local\s+function)\s+\w+/,
  };


  const langPattern = patterns[ext.slice(1)] || patterns.js;
  let currentChunk = [];
  let chunkStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk.push(line);

    // Check if we should start a new chunk
    const shouldSplit = 
      langPattern.test(line.trim()) && 
      currentChunk.length > config.chunkSize * 0.5;

    if (shouldSplit || currentChunk.length >= config.chunkSize + config.chunkOverlap) {
      if (currentChunk.join("\n").trim().length > 20) {
        chunks.push({
          text: currentChunk.join("\n"),
          startLine: chunkStartLine + 1,
          endLine: i + 1
        });
      }
      
      // Keep overlap
      currentChunk = currentChunk.slice(-config.chunkOverlap);
      chunkStartLine = i - config.chunkOverlap + 1;
    }
  }

  // Add remaining chunk
  if (currentChunk.length > 0 && currentChunk.join("\n").trim().length > 20) {
    chunks.push({
      text: currentChunk.join("\n"),
      startLine: chunkStartLine + 1,
      endLine: lines.length
    });
  }

  return chunks;
}
