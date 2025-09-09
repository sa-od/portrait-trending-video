const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const VideoProcessor = require("./videoProcessor");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI and Video Processor
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const videoProcessor = new VideoProcessor();

// Middleware - Enhanced CORS configuration for cross-browser compatibility
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Allow localhost and Vercel domains
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://instareel.vercel.app",
        "https://instareel-git-main.vercel.app",
        "https://instareel-git-main-sahood.vercel.app",
        "https://portrait-trending-video.vercel.app",
        // Add your Vercel domain here
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
    ],
    exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Handle preflight requests
app.options("*", cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("."));

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

// Serve the main application
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
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
