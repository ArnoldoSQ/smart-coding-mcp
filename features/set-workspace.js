/**
 * Set Workspace Feature
 * 
 * MCP tool to change the project workspace path at runtime.
 * Useful when agent detects it's in a different directory.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Get tool definition for MCP registration
 */
export function getToolDefinition(config) {
  return {
    name: "e_set_workspace",
    description: "Change the project workspace path at runtime. Use this when you detect the current workspace is incorrect or you need to switch to a different project directory. Creates cache folder automatically and optionally re-indexes the new workspace.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the new workspace directory"
        },
        clearCache: {
          type: "boolean",
          description: "Whether to clear existing cache before switching (default: false)"
        },
        reindex: {
          type: "boolean", 
          description: "Whether to trigger re-indexing after switching (default: true)"
        }
      },
      required: ["path"]
    }
  };
}

/**
 * Workspace Manager class
 */
export class WorkspaceManager {
  constructor(config, cache, indexer) {
    this.config = config;
    this.cache = cache;
    this.indexer = indexer;
  }

  /**
   * Set new workspace path
   */
  async setWorkspace(newPath, options = {}) {
    const { clearCache = false, reindex = true } = options;

    // Validate path
    try {
      const stats = await fs.stat(newPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${newPath}`
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Path does not exist: ${newPath}`
      };
    }

    const oldPath = this.config.searchDirectory;
    
    // Update config
    this.config.searchDirectory = newPath;
    
    // Update cache directory
    const newCacheDir = path.join(newPath, '.smart-coding-cache');
    this.config.cacheDirectory = newCacheDir;

    // Ensure cache directory exists
    try {
      await fs.mkdir(newCacheDir, { recursive: true });
    } catch (err) {
      // Ignore if already exists
    }

    // Clear cache if requested
    if (clearCache && this.cache) {
      this.cache.setVectorStore([]);
      this.cache.fileHashes = new Map();
      console.error(`[Workspace] Cache cleared for new workspace`);
    }

    // Update cache path and reload
    if (this.cache) {
      this.cache.config = this.config;
      await this.cache.load();
    }

    // Update indexer config
    if (this.indexer) {
      this.indexer.config = this.config;
    }

    console.error(`[Workspace] Changed from ${oldPath} to ${newPath}`);

    // Trigger re-indexing if requested
    let indexResult = null;
    if (reindex && this.indexer) {
      console.error(`[Workspace] Starting re-indexing...`);
      try {
        indexResult = await this.indexer.indexAll(clearCache);
      } catch (err) {
        console.error(`[Workspace] Re-indexing error: ${err.message}`);
      }
    }

    return {
      success: true,
      oldPath,
      newPath,
      cacheDirectory: newCacheDir,
      reindexed: reindex,
      indexResult
    };
  }
}

/**
 * Handle MCP tool call
 */
export async function handleToolCall(request, instance) {
  const { path: newPath, clearCache, reindex } = request.params.arguments || {};

  if (!newPath) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: "Missing required parameter: path"
        }, null, 2)
      }]
    };
  }

  const result = await instance.setWorkspace(newPath, { clearCache, reindex });

  return {
    content: [{
      type: "text",
      text: JSON.stringify(result, null, 2)
    }]
  };
}
