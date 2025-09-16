import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import VideoProcessor from "./videoProcessor.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI and Video Processor
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const videoProcessor = new VideoProcessor();

// Additional middleware for browser compatibility
app.use((req, res, next) => {
  // Add security headers for better browser compatibility
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");

  // Log requests for debugging
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${
      req.get("Origin") || "No Origin"
    } - User-Agent: ${req.get("User-Agent")?.substring(0, 50) || "Unknown"}`
  );

  next();
});

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3001", // Vite dev server
      "http://localhost:3000", // Express server
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from dist folder (built React app)
app.use(
  express.static("dist", {
    setHeaders: (res, path) => {
      // Set proper MIME types for static assets
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      } else if (path.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      } else if (path.endsWith(".html")) {
        res.setHeader("Content-Type", "text/html");
      }
    },
  })
);

// Serve additional static files from root for API endpoints
app.use("/api", express.static("."));

// Configure multer for file uploads - using memory storage for serverless compatibility
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

// Create necessary directories - using temp directory for serverless compatibility
const tempDir = os.tmpdir();
const uploadsDir = path.join(tempDir, "instareel-uploads");
const generatedDir = path.join(tempDir, "instareel-generated");
const tempDirPath = path.join(tempDir, "instareel-temp");

// Create directories safely
const createDirSafely = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.warn(`Could not create directory ${dirPath}:`, error.message);
    // Continue execution even if directory creation fails
  }
};

createDirSafely(uploadsDir);
createDirSafely(generatedDir);
createDirSafely(tempDirPath);

// File cleanup system
const cleanupInterval = 30 * 60 * 1000; // 30 minutes
const fileMaxAge = 2 * 60 * 60 * 1000; // 2 hours

const cleanupOldFiles = () => {
  try {
    const now = Date.now();
    const dirs = [uploadsDir, generatedDir, tempDirPath];

    dirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          const age = now - stats.mtime.getTime();

          if (age > fileMaxAge) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old file: ${file}`);
          }
        });
      }
    });
  } catch (error) {
    console.warn("File cleanup error:", error.message);
  }
};

// Start cleanup interval
setInterval(cleanupOldFiles, cleanupInterval);
console.log("File cleanup system started - cleaning every 30 minutes");

// Routes

// Serve the React application
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    origin: req.get("Origin") || "No Origin",
    userAgent: req.get("User-Agent") || "Unknown",
    method: req.method,
    url: req.url,
  });
});

// Storage monitoring endpoint
app.get("/api/storage", (req, res) => {
  try {
    const getDirSize = (dirPath) => {
      if (!fs.existsSync(dirPath)) return { files: 0, size: 0 };

      const files = fs.readdirSync(dirPath);
      let totalSize = 0;

      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return { files: files.length, size: totalSize };
    };

    const uploadsInfo = getDirSize(uploadsDir);
    const generatedInfo = getDirSize(generatedDir);
    const tempInfo = getDirSize(tempDirPath);

    const totalSize = uploadsInfo.size + generatedInfo.size + tempInfo.size;

    res.json({
      directories: {
        uploads: {
          path: uploadsDir,
          ...uploadsInfo,
          sizeFormatted: formatBytes(uploadsInfo.size),
        },
        generated: {
          path: generatedDir,
          ...generatedInfo,
          sizeFormatted: formatBytes(generatedInfo.size),
        },
        temp: {
          path: tempDirPath,
          ...tempInfo,
          sizeFormatted: formatBytes(tempInfo.size),
        },
      },
      total: {
        size: totalSize,
        sizeFormatted: formatBytes(totalSize),
      },
      cleanup: {
        interval: "30 minutes",
        maxAge: "2 hours",
      },
    });
  } catch (error) {
    console.error("Storage monitoring error:", error);
    res.status(500).json({ error: "Failed to get storage info" });
  }
});

// Helper function to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// AI Title Generation
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Generate exactly 3 relatable, controversial, and hooky video titles based on this topic: '${topic}'. Each title must be 3 to 4 words long, in ALL CAPS. Do not use quotes.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates video titles. Always respond with valid JSON containing an array of titles.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);

    if (!result.titles || !Array.isArray(result.titles)) {
      throw new Error("Invalid response format from AI");
    }

    res.json({ titles: result.titles.slice(0, 3) });
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({
      error: "Failed to generate titles",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Video Upload
app.post("/api/upload-video", upload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    // Save file to temporary directory
    const filename = `${uuidv4()}-${req.file.originalname}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const videoInfo = {
      filename: filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: filePath,
    };

    res.json({
      message: "Video uploaded successfully",
      video: videoInfo,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

// Generate Video with Titles
app.post("/api/generate-video", async (req, res) => {
  try {
    const { videoFilename, titles, colors } = req.body;

    if (
      !videoFilename ||
      !titles ||
      !Array.isArray(titles) ||
      titles.length !== 3
    ) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const videoPath = path.join(uploadsDir, videoFilename);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found" });
    }

    const outputFilename = `generated-${uuidv4()}.mp4`;
    const outputPath = path.join(generatedDir, outputFilename);

    // Process video with individual titles using FFmpeg
    const generatedVideos = await videoProcessor.generateIndividualVideos(
      videoPath,
      titles,
      colors
    );

    const response = {
      videos: generatedVideos,
      message: "Individual videos generated successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Video Generation Error:", error);
    res.status(500).json({ error: "Failed to generate video" });
  }
});

// Generate Individual Video
app.post("/api/generate-individual-video", async (req, res) => {
  try {
    const { videoFilename, title, color, videoIndex } = req.body;

    if (!videoFilename || !title || !color) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const videoPath = path.join(uploadsDir, videoFilename);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found" });
    }

    const outputFilename = `generated-${videoIndex + 1}-${Date.now()}.mp4`;
    const outputPath = path.join(generatedDir, outputFilename);

    // Process video with single title using FFmpeg
    await videoProcessor.generateSingleTitleVideo(
      videoPath,
      outputPath,
      title,
      color
    );

    const response = {
      filename: outputFilename,
      path: outputPath,
      title: title,
      color: color,
      downloadUrl: `/api/download/${outputFilename}`,
      message: "Individual video generated successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Individual Video Generation Error:", error);
    res.status(500).json({ error: "Failed to generate individual video" });
  }
});

// Download Generated Video
app.get("/api/download/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(generatedDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Download Error:", err);
        res.status(500).json({ error: "Failed to download file" });
      }
    });
  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Catch-all handler for client-side routing (must be after API routes)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled Error:", error);
  res.status(500).json({
    error: "Internal server error",
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(
    `OpenAI API configured: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`
  );
});
