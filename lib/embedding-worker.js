import { parentPort, workerData } from "worker_threads";
import { pipeline, layer_norm } from "@huggingface/transformers";

let embedder = null;
const VALID_DIMENSIONS = [64, 128, 256, 512, 768];

// Initialize the embedding model once when worker starts
async function initializeEmbedder() {
  if (!embedder) {
    const modelName = workerData.embeddingModel || 'nomic-ai/nomic-embed-text-v1.5';
    const dimension = workerData.embeddingDimension || 256;
    const targetDim = VALID_DIMENSIONS.includes(dimension) ? dimension : 256;
    const isNomic = modelName.includes('nomic');
    
    const extractor = await pipeline("feature-extraction", modelName);
    
    if (isNomic) {
      // MRL embedder with dimension slicing
      embedder = async function(text, options = {}) {
        let embeddings = await extractor(text, { pooling: 'mean' });
        embeddings = layer_norm(embeddings, [embeddings.dims[1]])
          .slice(null, [0, targetDim])
          .normalize(2, -1);
        return { data: embeddings.data };
      };
      embedder.dimension = targetDim;
    } else {
      // Legacy embedder (MiniLM etc.)
      embedder = async function(text, options = {}) {
        return await extractor(text, { pooling: 'mean', normalize: true });
      };
      embedder.dimension = 384;
    }
    
    embedder.modelName = modelName;
  }
  return embedder;
}

/**
 * Process chunks with optimized single-text embedding
 * Note: Batch processing with transformers.js WASM backend doesn't improve speed
 * because it loops internally. Single calls are actually faster.
 */
async function processChunks(chunks) {
  const embedder = await initializeEmbedder();
  const results = [];

  for (const chunk of chunks) {
    try {
      const output = await embedder(chunk.text, { pooling: "mean", normalize: true });
      results.push({
        file: chunk.file,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.text,
        vector: Array.from(output.data),
        success: true
      });
    } catch (error) {
      results.push({
        file: chunk.file,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        error: error.message,
        success: false
      });
    }
  }

  return results;
}

// Listen for messages from main thread
parentPort.on("message", async (message) => {
  if (message.type === "process") {
    try {
      const results = await processChunks(message.chunks);
      parentPort.postMessage({ type: "results", results, batchId: message.batchId });
    } catch (error) {
      parentPort.postMessage({ type: "error", error: error.message, batchId: message.batchId });
    }
  } else if (message.type === "shutdown") {
    process.exit(0);
  }
});

// Signal that worker is ready
initializeEmbedder().then(() => {
  parentPort.postMessage({ type: "ready" });
}).catch((error) => {
  parentPort.postMessage({ type: "error", error: error.message });
});

