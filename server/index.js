
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs").promises;
const path = require('path');
require('dotenv').config();
const setupFileWatcher = require('./fileWatcher');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const MAX_RECTANGLES = 100;

console.log('Starting server initialization...');

// Log environment variables
console.log('Environment variables:');
console.log(`PORT: ${process.env.PORT || 5000}`);
console.log(`SECRET_KEY: ${process.env.SECRET_KEY ? '[SET]' : '[NOT SET]'}`);
console.log(`COMFYUI_TEMP_DIR: ${process.env.COMFYUI_TEMP_DIR}`);
console.log(`COMFYUI_RETURN_DIR: ${process.env.COMFYUI_RETURN_DIR}`);
console.log(`COMFYUI_IMAGE_DIR: ${process.env.COMFYUI_IMAGE_DIR}`);
console.log(`WHISPER_INPUTS_DIR: ${process.env.WHISPER_INPUTS_DIR}`);


const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5000'],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: corsOptions
});

const port = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || "your-secret-key";
const COMFYUI_RETURN_DIR = process.env.COMFYUI_RETURN_DIR || '/usr/src/app/comfyui_returns';
const COMFYUI_TEMP_DIR = process.env.COMFYUI_TEMP_DIR || '/usr/src/app/comfyui_temp';
const COMFYUI_IMAGE_DIR = process.env.COMFYUI_IMAGE_DIR || '/usr/src/app/comfyui_images';
const COMFYUI_SEARCH_DIR = process.env.COMFYUI_SEARCH_DIR || '/usr/src/app/comfyui_search';
const WHISPER_INPUTS_DIR = process.env.WHISPER_INPUTS_DIR || '/usr/src/app/whisper_inputs';

console.log('COMFYUI_RETURN_DIR:', COMFYUI_RETURN_DIR);
console.log('COMFYUI_TEMP_DIR:', COMFYUI_TEMP_DIR);
console.log('COMFYUI_IMAGE_DIR:', COMFYUI_IMAGE_DIR);
console.log('COMFYUI_SEARCH_DIR:', COMFYUI_SEARCH_DIR);
console.log('WHISPER_INPUTS_DIR:', WHISPER_INPUTS_DIR);

// Canvas state
let canvasState = {
  rectangles: [],
  cursors: {},
  processedFiles: new Set() 
};

const handleNewAgentResponse = async (filename, content, type) => {
  console.log('New agent response received:', filename, 'Type:', type);
  try {
    if (type === 'whisper_input') {
      console.log('Received whisper input:', content);
      io.emit('newPrimitiveRectangle', { content, filename });
      return;
    }

    let newRect;
    
    if (type === 'image') {
      const width = 534; // 512 + 2 * 11 (padding)
      const height = 534; // 512 + 2 * 11 (padding)
      const gap = 11;

      // Get the last rectangle, if any
      const lastRect = canvasState.rectangles[canvasState.rectangles.length - 1];

      let x, y;
      if (lastRect) {
        x = lastRect.x + lastRect.width + gap;
        y = lastRect.y;
      } else {
        x = 50; // Default starting position
        y = 50;
      }

      newRect = {
        x,
        y,
        width,
        height,
        imageSrc: filename,
        isResponse: true,
        type: 'image',
        index: canvasState.rectangles.length
      };
    } else {
      // Text rectangle creation with dynamic sizing
      const estimatedWidth = 300; // Base width
      const estimatedHeight = Math.max(200, Math.ceil(content.length / 50) * 20);

      const lastRect = canvasState.rectangles[canvasState.rectangles.length - 1];
      const x = lastRect ? lastRect.x : 50;
      const y = lastRect ? lastRect.y + lastRect.height + 50 : 50;

      newRect = {
        x,
        y,
        width: estimatedWidth,
        height: estimatedHeight,
        text: content,
        isResponse: true,
        type: type, // This will be 'text' or 'search'
        index: canvasState.rectangles.length
      };
    }

    canvasState.rectangles.push(newRect);

    io.emit('newComfyUIResponse', { 
      filename, 
      content,
      type,
      rectangle: newRect
    });

    console.log(`Emitted new agent response: ${filename}, Type: ${type}`);
  } catch (error) {
    console.error('Error handling new agent response:', error);
  }
  // try {
  //   if (type === 'whisper_input') {
  //     console.log('Received whisper input:', content);
  //     io.emit('newPrimitiveRectangle',{content , filename});
  //     return;
  //   }

  //   const lastUserRect = canvasState.rectangles.find(rect => !rect.isResponse);
  //   const lastResponseRect = canvasState.rectangles.slice().reverse().find(rect => rect.isResponse);

  //   if (lastUserRect) {
  //     let newRect;
  //     const userRectBottomEdge = lastUserRect.y + lastUserRect.height;
      
  //     if (type === 'image') {
  //       const width = 534; // 512 + 2 * 11 (padding)
  //       const height = 534; // 512 + 2 * 11 (padding)
  //       const gap = 11;
  //       let x, y;

  //       if (lastResponseRect && lastResponseRect.type === 'image') {
  //         x = lastResponseRect.x + width + gap;
  //         y = lastResponseRect.y;
  //       } else {
  //         x = lastUserRect.x + lastUserRect.width + 50;
  //         y = lastUserRect.y;
  //       }

  //       newRect = {
  //         x,
  //         y,
  //         width,
  //         height,
  //         imageSrc: filename,
  //         isResponse: true,
  //         type: 'image',
  //         index: canvasState.rectangles.length
  //       };
  //     } else {
  //       // Text rectangle creation with dynamic sizing
  //       const estimatedWidth = 300; // Base width
  //       const estimatedHeight = Math.max(200, Math.ceil(content.length / 50) * 20); // Rough estimate of height based on content length

  //       newRect = {
  //         x: lastUserRect.x,
  //         y: userRectBottomEdge + 50, // Position 50px below the user rectangle
  //         width: estimatedWidth,
  //         height: estimatedHeight,
  //         text: content,
  //         isResponse: true,
  //         type: type, // This will be 'text' or 'search'
  //         index: canvasState.rectangles.length
  //       };
  //     }

  //     canvasState.rectangles.push(newRect);

  //     // Emit the new response to all connected clients
  //     canvasState.rectangles.push(newRect);

  //     io.emit('newComfyUIResponse', { 
  //       filename, 
  //       content,
  //       type:'image',
  //       rectangle: newRect
  //     });

  //     console.log(`Emitted new agent response: ${filename}, Type: ${type}`);
  //   } else {
  //     console.error('No user question found to associate with this response');
  //   }
  // } catch (error) {
  //   console.error('Error handling new agent response:', error);
  // }
};


// Update the setupFileWatcher call to include the type parameter
setupFileWatcher(
  io,
  COMFYUI_RETURN_DIR,
  COMFYUI_IMAGE_DIR,
  COMFYUI_SEARCH_DIR,
  WHISPER_INPUTS_DIR,
  canvasState,
  handleNewAgentResponse
);

app.use('/images', express.static(COMFYUI_IMAGE_DIR));

async function checkForNewFiles(socket = null) {
  try {
    const files = await fs.readdir(COMFYUI_RETURN_DIR);
    
    for (const file of files) {
      if (!canvasState.processedFiles.has(file)) {
        const filepath = path.join(COMFYUI_RETURN_DIR, file);
        try {
          const content = await fs.readFile(filepath, 'utf8');
          const newRect = {
            x: 10,
            y: canvasState.rectangles.length * 110 + 10,
            width: 300,
            height: 100,
            text: content,
            isResponse: true,
            index: canvasState.rectangles.length
          };
          canvasState.rectangles.push(newRect);
          const event = { filename: file, content, rectangle: newRect };
          if (socket) {
            socket.emit('newComfyUIResponse', event);
          } else {
            io.emit('newComfyUIResponse', event);
          }
          console.log('Emitted newComfyUIResponse event for:', file);
          canvasState.processedFiles.add(file);
        } catch (error) {
          console.error('Error reading file:', filepath, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking for new files:', error);
  }
}

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    let user = users.find(u => u.username === username);
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = { id: users.length + 1, username, password: hashedPassword };
      users.push(user);
    } else {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    
    res.json({ token, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Temporary user storage (replace with a database in a production environment)
const users = [];

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on("userJoined", (user) => {
    console.log(`User joined: ${JSON.stringify(user)}`);
    const color = Object.keys(canvasState.cursors).length === 0 ? "#FFFFFF" : "#24FF00";
    canvasState.cursors[socket.id] = { x: 0, y: 0, color, id: user.id };
    io.emit("updateCursors", canvasState.cursors);
    socket.emit("initializeCanvas", canvasState);
  });

  socket.on("updateCursor", ({ x, y }) => {
    if (canvasState.cursors[socket.id]) {
      canvasState.cursors[socket.id].x = x;
      canvasState.cursors[socket.id].y = y;
      io.emit("updateCursors", canvasState.cursors);
    }
  });

  socket.on("userLeft", (userId) => {
    console.log(`User left: ${userId}`);
    canvasState.users = canvasState.users.filter(user => user.id !== userId);
    io.emit("updateUsers", canvasState.users);
  });

  socket.on("newRectangle", async (newRect) => {
    if (canvasState.rectangles.length < MAX_RECTANGLES) {
      const index = canvasState.rectangles.length;
      const rectangleWithIndex = { ...newRect, index, isUserCreated: true, isResponse: false };
      canvasState.rectangles.push(rectangleWithIndex);
      console.log(`New rectangle added. Total rectangles: ${canvasState.rectangles.length}, Index: ${index}`);
      
      try {
        const filename = `rectangle_${index}_${Date.now()}.txt`;
        const filepath = path.join(COMFYUI_TEMP_DIR, filename);
        await fs.writeFile(filepath, newRect.text || '');
        console.log(`Successfully wrote new rectangle to file: ${filepath}`);
      } catch (error) {
        console.error('Error writing new rectangle to file:', error);
      }
      
      io.emit("newRectangle", rectangleWithIndex);
    } else {
      socket.emit("maxRectanglesReached");
    }
  });

  // Lines 191-195: Update clearCanvas event
  socket.on("clearCanvas", () => {
    console.log("Clearing canvas");
    canvasState.rectangles = [];
    io.emit("updateCanvas", canvasState.rectangles);
  });
  
  // Lines 197-218: Update updateRectangleText event
  socket.on("updateRectangleText", async ({ index, text, userId, height }) => {
    console.log(`Attempting to update rectangle text for user ${userId}, index ${index}: ${text}`);
    const rectangleIndex = canvasState.rectangles.findIndex(rect => rect.index === index);
    if (rectangleIndex !== -1) {
      canvasState.rectangles[rectangleIndex].text = text;
      if (height) {
        canvasState.rectangles[rectangleIndex].height = height;
      }
      io.emit("updateRectangleText", { index, text, height });
  
      try {
        const filename = `rectangle_${index}_user_${userId}_${Date.now()}.txt`;
        const filepath = path.join(COMFYUI_TEMP_DIR, filename);
        await fs.writeFile(filepath, text || '');
        console.log(`Successfully wrote updated text to file: ${filepath}`);
        socket.emit("fileSaved", { success: true, filename });
      } catch (error) {
        console.error('Error writing to file:', error);
        socket.emit("fileSaved", { success: false, error: error.message });
      }
    } else {
      console.error(`Invalid rectangle index: ${index}. Total rectangles: ${canvasState.rectangles.length}`);
      socket.emit("fileSaved", { success: false, error: "Invalid rectangle index" });
    }
  });

  socket.on("saveCanvasFile", async ({ filename, content }) => {
    try {
      const filepath = path.join(COMFYUI_TEMP_DIR, filename);
      await fs.writeFile(filepath, content);
      console.log(`Successfully saved file: ${filepath}`);
      socket.emit("fileSaved", { success: true, filename });
    } catch (error) {
      console.error('Error saving file:', error);
      socket.emit("fileSaved", { success: false, error: error.message });
    }
  });

  socket.on('requestComfyUIResponse', async ({ filename }) => {
    console.log('Received request for ComfyUI response:', filename);
    try {
      const filepath = path.join(COMFYUI_RETURN_DIR, filename);
      console.log('Attempting to read file:', filepath);
      const content = await fs.promises.readFile(filepath, 'utf8');
      console.log('File content read successfully');
      socket.emit('comfyUIResponse', { filename, content });
      console.log('ComfyUI response emitted to client');
    } catch (error) {
      console.error('Error reading ComfyUI response:', error);
      socket.emit('comfyUIResponse', { error: 'Failed to read response' });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    delete canvasState.cursors[socket.id];
    io.emit("updateCursors", canvasState.cursors);
  });
});


// Update the initializeServer function in index.js

async function initializeServer() {
  try {
    // Create an array of all required directories
    const requiredDirs = [
      COMFYUI_RETURN_DIR,
      COMFYUI_TEMP_DIR,
      COMFYUI_IMAGE_DIR,
      COMFYUI_SEARCH_DIR,
      WHISPER_INPUTS_DIR
    ];

    // Create directories if they don't exist
    for (const dir of requiredDirs) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Directory created or already exists: ${dir}`);
    }

    console.log('All required directories are accessible, including WHISPER_INPUTS_DIR');
    
    const agentReturnPath = path.join(COMFYUI_RETURN_DIR, 'agent_return.txt');
    await fs.writeFile(agentReturnPath, 'Initial agent return file');
    console.log('Agent return file created successfully:', agentReturnPath);

    // Call createWhisperTestFile here
    await createWhisperTestFile();

    server.listen(port, '0.0.0.0', (err) => {
      if (err) {
        console.error('Failed to start server:', err);
        return;
      }
      console.log(`Server successfully started and running on 0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Error initializing server:', error);
  }
}

// Add the createWhisperTestFile function
async function createWhisperTestFile() {
  const testFilePath = path.join(WHISPER_INPUTS_DIR, `test_whisper_${Date.now()}.txt`);
  try {
    await fs.writeFile(testFilePath, 'This is a test whisper input file');
    console.log('Created test whisper input file:', testFilePath);
  } catch (error) {
    console.error('Error creating test whisper input file:', error);
  }
}

// Call initializeServer
initializeServer().catch(error => {
  console.error('Failed to initialize server:', error);
});

console.log(`Server Configuration:
  Port: ${port}
  ComfyUI Temp Dir: ${COMFYUI_TEMP_DIR}
`);