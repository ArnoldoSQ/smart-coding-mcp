/**
 * Get Status Feature
 * 
 * MCP tool to return comprehensive status information about the server.
 * Useful for agents to understand current state and configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Get tool definition for MCP registration
 */
export function getToolDefinition(config) {
  return {
    name: "f_get_status",
    description: "Get comprehensive status information about the Smart Coding MCP server. Returns version, workspace path, model configuration, indexing status, and cache information. Useful for understanding the current state of the semantic search system.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  };
}

/**
 * Status Reporter class
 */
export class StatusReporter {
  constructor(config, cache, indexer, embedder) {
    this.config = config;
    this.cache = cache;
    this.indexer = indexer;
    this.embedder = embedder;
    this.startTime = Date.now();
  }

  /**
   * Get comprehensive status
   */
  async getStatus() {
    const vectorStore = this.cache?.getVectorStore() || [];
    
    // Get unique files from vector store
    const uniqueFiles = new Set(vectorStore.map(v => v.file));
    
    // Get cache size
    let cacheSizeBytes = 0;
    try {
      const cachePath = path.join(this.config.cacheDirectory, 'embeddings.json');
      const stats = await fs.stat(cachePath);
      cacheSizeBytes = stats.size;
    } catch {
      // Cache file doesn't exist yet
    }

    // Determine index status
    let indexStatus = 'empty';
    if (this.indexer?.isIndexing) {
      indexStatus = 'indexing';
    } else if (vectorStore.length > 0) {
      indexStatus = 'ready';
    }

    return {
      version: packageJson.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      
      workspace: {
        path: this.config.searchDirectory,
        cacheDirectory: this.config.cacheDirectory
      },

      model: {
        name: this.embedder?.modelName || this.config.embeddingModel,
        dimension: this.embedder?.dimension || this.config.embeddingDimension,
        device: this.embedder?.device || this.config.device
      },

      index: {
        status: indexStatus,
        filesIndexed: uniqueFiles.size,
        chunksCount: vectorStore.length,
        chunkingMode: this.config.chunkingMode
      },

      cache: {
        enabled: this.config.enableCache,
        path: this.config.cacheDirectory,
        sizeBytes: cacheSizeBytes,
        sizeFormatted: formatBytes(cacheSizeBytes)
      },

      config: {
        maxResults: this.config.maxResults,
        chunkSize: this.config.chunkSize,
        semanticWeight: this.config.semanticWeight,
        exactMatchBoost: this.config.exactMatchBoost,
        workerThreads: this.config.workerThreads
      }
    };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Handle MCP tool call
 */
export async function handleToolCall(request, instance) {
  const status = await instance.getStatus();

  return {
    content: [{
      type: "text",
      text: JSON.stringify(status, null, 2)
    }]
  };
}
