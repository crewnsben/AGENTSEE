// fileWatcher.js

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;

function setupFileWatcher(io, comfyuiReturnDir, comfyuiImageDir, comfyuiSearchDir, whisperInputsDir, canvasState, handleNewAgentResponse) {
  console.log('Setting up file watcher for directories:');
  console.log('COMFYUI_RETURN_DIR:', comfyuiReturnDir);
  console.log('COMFYUI_IMAGE_DIR:', comfyuiImageDir);
  console.log('COMFYUI_SEARCH_DIR:', comfyuiSearchDir);
  console.log('WHISPER_INPUTS_DIR:', whisperInputsDir);
  console.log('Received handleNewAgentResponse:', typeof handleNewAgentResponse);

  // Ensure canvasState and its properties are properly initialized
  canvasState = canvasState || {};
  canvasState.processedFiles = canvasState.processedFiles || new Set();

  // Check if handleNewAgentResponse is a function
  if (typeof handleNewAgentResponse !== 'function') {
    console.error('handleNewAgentResponse is not a function');
    return;
  }

  const watchOptions = {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true, // Change this to true to ignore existing files
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    },
    usePolling: true,
    interval: 100
  };

  function createWatcher(dir, type) {
    if (!dir) {
      console.error(`${type} directory is not defined`);
      return null;
    }

    try {
      const watcher = chokidar.watch(dir, watchOptions);
      console.log(`${type} watcher initialized for directory:`, dir);
      return watcher;
    } catch (error) {
      console.error(`Error initializing ${type} watcher:`, error);
      return null;
    }
  }

  const textWatcher = createWatcher(comfyuiReturnDir, 'Text');
  const imageWatcher = createWatcher(comfyuiImageDir, 'Image');
  const searchWatcher = createWatcher(comfyuiSearchDir, 'Search');
  const whisperInputWatcher = createWatcher(whisperInputsDir, 'Whisper input');

  if (textWatcher) {
    textWatcher.on('add', async (filepath) => {
      console.log('Text file watcher: New file detected:', filepath);
      handleFile(filepath, 'text');
    });
  }

  if (imageWatcher) {
    imageWatcher.on('add', async (filepath) => {
      console.log('Image file watcher: New file detected:', filepath);
      handleFile(filepath, 'image');
    });
  }

  if (searchWatcher) {
    searchWatcher.on('add', async (filepath) => {
      console.log('Search file watcher: New file detected:', filepath);
      handleFile(filepath, 'search');
    });
  }

  if (whisperInputWatcher) {
    whisperInputWatcher
      .on('add', async (filepath) => {
        console.log('Whisper input file watcher: New file detected:', filepath);
        handleFile(filepath, 'whisper_input');
      })
      .on('change', (filepath) => {
        console.log('Whisper input file watcher: File changed:', filepath);
      })
      .on('unlink', (filepath) => {
        console.log('Whisper input file watcher: File removed:', filepath);
      })
      .on('error', (error) => {
        console.error('Whisper input file watcher error:', error);
      });
  
    console.log('Whisper input watcher is now actively watching for changes');
  }

  async function handleFile(filepath, type) {
    const filename = path.basename(filepath);
    if (!canvasState.processedFiles.has(filename)) {
      try {
        let content = null;
        if (type !== 'image') {
          content = await fs.readFile(filepath, 'utf8');
          console.log(`${type} file content read successfully:`, filename);
        } else {
          const stats = await fs.stat(filepath);
          console.log('Image file stats read successfully:', filename);
        }
        console.log(`Calling handleNewAgentResponse with type: ${type}`);
        handleNewAgentResponse(filename, content, type);
        canvasState.processedFiles.add(filename);
      } catch (error) {
        console.error(`Error processing ${type} file:`, filepath, error);
      }
    } else {
      console.log(`${type} file already processed:`, filename);
    }
  }
}

module.exports = setupFileWatcher;
