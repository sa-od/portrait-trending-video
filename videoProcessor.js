import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import os from "os";

class VideoProcessor {
  constructor() {
    this.setupFFmpeg();
  }

  setupFFmpeg() {
    if (process.platform === "darwin") {
      ffmpeg.setFfmpegPath("/opt/homebrew/bin/ffmpeg");
      ffmpeg.setFfprobePath("/opt/homebrew/bin/ffprobe");
    }
    // Add Windows paths when needed
  }

  // Get video width and height
  async getVideoDimensions(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(
            (stream) => stream.codec_type === "video"
          );
          resolve({
            width: videoStream.width,
            height: videoStream.height,
          });
        }
      });
    });
  }

  // Calculate font size based on video size
  calculateFontSize(width, height) {
    const isVertical = height > width;

    if (isVertical) {
      // For vertical videos, use 8% of width
      return Math.round(width * 0.08);
    } else {
      // For horizontal videos, use 6% of height
      return Math.round(height * 0.06);
    }
  }

  // Break text into multiple lines
  breakTextIntoLines(text, maxCharsPerLine = 12) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      // Check if adding this word would make the line too long
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length > maxCharsPerLine && currentLine) {
        // Start new line
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Add the last line
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  // Main function to add text to video
  async generateSingleTitleVideo(
    inputPath,
    outputPath,
    title,
    color = "white"
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get video size
        const { width, height } = await this.getVideoDimensions(inputPath);
        const isVertical = height > width;

        // Calculate font size
        const fontSize = Math.round(
          this.calculateFontSize(width, height) * 1.33
        );

        // Break title into lines
        const maxChars = isVertical ? 10 : 15;
        const lines = this.breakTextIntoLines(title, maxChars);

        // Position settings
        const startY = Math.round(height * 0.1); // 10% from top
        const lineHeight = fontSize * 1.4; // Space between lines

        // Create text filters for each line
        const textFilters = lines.map((line, index) => {
          const yPos = startY + index * lineHeight;

          // Escape special characters for FFmpeg
          const escapedText = line
            .replace(/'/g, "\\'")
            .replace(/:/g, "\\:")
            .replace(/,/g, "\\,");

          return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPos}:shadowcolor=black@0.8:shadowx=2:shadowy=2:borderw=4:bordercolor=black:fontfile=/System/Library/Fonts/Supplemental/Poppins-Black.ttf`;
        });

        // Create FFmpeg command
        const command = ffmpeg(inputPath)
          .videoFilters(textFilters.join(","))
          .outputOptions([
            "-c:v libx264",
            "-c:a aac",
            "-preset fast",
            "-crf 23",
            "-movflags +faststart",
          ])
          .output(outputPath);

        // Event handlers
        command
          .on("start", () => {
            console.log(`Processing video: ${width}x${height}`);
            console.log(`Font size: ${fontSize}`);
            console.log(`Lines: ${lines.join(" | ")}`);
          })
          .on("progress", (progress) => {
            if (progress.percent) {
              console.log(`Progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on("end", () => {
            console.log("Video processing completed");
            resolve(outputPath);
          })
          .on("error", (err) => {
            console.error("Error:", err.message);
            reject(err);
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Process multiple videos with different titles
  async generateMultipleVideos(inputPath, titles, colors = []) {
    const results = [];

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const color = colors[i] || "white";
      const outputName = `video-${i + 1}-${Date.now()}.mp4`;
      const outputPath = path.join(__dirname, "generated", outputName);

      try {
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        await this.generateSingleTitleVideo(
          inputPath,
          outputPath,
          title,
          color
        );

        results.push({
          title,
          filename: outputName,
          path: outputPath,
          success: true,
        });

        console.log(`✓ Generated: ${outputName}`);
      } catch (error) {
        console.error(`✗ Failed: ${title} - ${error.message}`);
        results.push({
          title,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Generate individual videos for the API
  async generateIndividualVideos(inputPath, titles, colors = []) {
    const results = [];

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const color = colors[i] || "white";
      const outputName = `generated-${i + 1}-${Date.now()}.mp4`;
      const outputPath = path.join(
        process.env.TEMP || require("os").tmpdir(),
        "instareel-generated",
        outputName
      );

      try {
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        await this.generateSingleTitleVideo(
          inputPath,
          outputPath,
          title,
          color
        );

        results.push({
          title,
          filename: outputName,
          path: outputPath,
          downloadUrl: `/api/download/${outputName}`,
          success: true,
        });

        console.log(`✓ Generated: ${outputName}`);
      } catch (error) {
        console.error(`✗ Failed: ${title} - ${error.message}`);
        results.push({
          title,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Get basic video information
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(
            (s) => s.codec_type === "video"
          );
          resolve({
            duration: metadata.format.duration,
            width: videoStream.width,
            height: videoStream.height,
            fps: videoStream.r_frame_rate,
            format: metadata.format.format_name,
          });
        }
      });
    });
  }
}

export default VideoProcessor;

/* 
USAGE:

const processor = new VideoProcessor();

// Single video with title
await processor.generateSingleTitleVideo(
  'input.mp4',
  'output.mp4', 
  'This Long Title Will Break Into Lines',
  'white'
);

// Multiple videos
const results = await processor.generateMultipleVideos(
  'input.mp4',
  ['Title One', 'Another Long Title Here', 'Short'],
  ['white', 'yellow', 'red']
);
*/
