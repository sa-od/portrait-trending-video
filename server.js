const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("."));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

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

// Create necessary directories
const dirs = ["uploads", "generated", "temp"];
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Routes

// Serve the main application
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

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

    const videoInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
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

    const videoPath = path.join(__dirname, "uploads", videoFilename);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video file not found" });
    }

    const outputFilename = `generated-${uuidv4()}.mp4`;
    const outputPath = path.join(__dirname, "generated", outputFilename);

    // Process video with titles using FFmpeg
    await videoProcessor.generateVideoWithTitles(
      videoPath,
      outputPath,
      titles,
      colors
    );

    const generatedVideo = {
      filename: outputFilename,
      path: outputPath,
      downloadUrl: `/api/download/${outputFilename}`,
      message: "Video generation completed successfully",
    };

    res.json(generatedVideo);
  } catch (error) {
    console.error("Video Generation Error:", error);
    res.status(500).json({ error: "Failed to generate video" });
  }
});

// Download Generated Video
app.get("/api/download/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "generated", filename);

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
