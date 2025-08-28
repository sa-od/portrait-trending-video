const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);

class VideoProcessor {
  constructor() {
    this.setupFFmpeg();
  }

  setupFFmpeg() {
    // Set FFmpeg path for different platforms
    if (process.platform === "win32") {
      // Windows FFmpeg path
      // ffmpeg.setFfmpegPath('C:\\path\\to\\ffmpeg.exe');
      // ffmpeg.setFfprobePath('C:\\path\\to\\ffprobe.exe');
    } else if (process.platform === "darwin") {
      // macOS FFmpeg path (Homebrew installation)
      ffmpeg.setFfmpegPath("/opt/homebrew/bin/ffmpeg");
      ffmpeg.setFfprobePath("/opt/homebrew/bin/ffprobe");
    }
  }

  async generateVideoWithTitles(inputPath, outputPath, titles, colors) {
    return new Promise((resolve, reject) => {
      try {
        // Build the drawtext filter string for all titles
        const drawtextFilters = titles
          .map((title, index) => {
            const color = colors[index] || "white";
            const yPosition = 50 + index * 80;
            // Escape special characters properly for FFmpeg
            const escapedTitle = title
              .replace(/'/g, "\\'")
              .replace(/:/g, "\\:")
              .replace(/,/g, "\\,");
            return `drawtext=text='${escapedTitle}':fontsize=48:fontcolor=${color}:x=(w-text_w)/2:y=${yPosition}:font=Arial-Bold:shadowcolor=black:shadowx=2:shadowy=2`;
          })
          .join(",");

        let command = ffmpeg(inputPath);

        // Apply all title overlays as a single video filter
        if (drawtextFilters) {
          command = command.videoFilters(drawtextFilters);
        }

        command
          .outputOptions([
            "-c:v libx264", // Video codec
            "-c:a aac", // Audio codec
            "-preset fast", // Encoding preset
            "-crf 23", // Quality setting
            "-movflags +faststart", // Web optimization
          ])
          .output(outputPath)
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
          })
          .on("progress", (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on("end", () => {
            console.log("Video processing completed");
            resolve(outputPath);
          })
          .on("error", (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateIndividualVideos(inputPath, titles, colors) {
    const results = [];

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const color = colors[i] || "white";
      const outputFilename = `generated-${i + 1}-${Date.now()}.mp4`;
      const outputPath = path.join(__dirname, "generated", outputFilename);

      try {
        await this.generateSingleTitleVideo(
          inputPath,
          outputPath,
          title,
          color
        );
        results.push({
          filename: outputFilename,
          path: outputPath,
          title: title,
          color: color,
          downloadUrl: `/api/download/${outputFilename}`,
        });
      } catch (error) {
        console.error(`Error generating video ${i + 1}:`, error);
        throw error;
      }
    }

    return results;
  }

  async generateSingleTitleVideo(inputPath, outputPath, title, color) {
    return new Promise((resolve, reject) => {
      try {
        // Escape special characters properly for FFmpeg
        const escapedTitle = title
          .replace(/'/g, "\\'")
          .replace(/:/g, "\\:")
          .replace(/,/g, "\\,");

        const drawtextFilter = `drawtext=text='${escapedTitle}':fontsize=48:fontcolor=${color}:x=(w-text_w)/2:y=50:font=Arial-Bold:shadowcolor=black:shadowx=2:shadowy=2`;

        let command = ffmpeg(inputPath);

        // Apply single title overlay
        command = command.videoFilters(drawtextFilter);

        command
          .outputOptions([
            "-c:v libx264", // Video codec
            "-c:a aac", // Audio codec
            "-preset fast", // Encoding preset
            "-crf 23", // Quality setting
            "-movflags +faststart", // Web optimization
          ])
          .output(outputPath)
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
          })
          .on("progress", (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on("end", () => {
            console.log("Video processing completed");
            resolve(outputPath);
          })
          .on("error", (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  async createTitleOverlay(title, color, fontSize = 48) {
    const svgContent = `
      <svg width="800" height="100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.8"/>
          </filter>
        </defs>
        <text x="400" y="60" 
              font-family="Arial, sans-serif" 
              font-size="${fontSize}" 
              font-weight="bold" 
              text-anchor="middle" 
              fill="${color}"
              filter="url(#shadow)">
          ${title}
        </text>
      </svg>
    `;

    const overlayPath = path.join(
      __dirname,
      "temp",
      `overlay-${Date.now()}.svg`
    );
    await writeFileAsync(overlayPath, svgContent);
    return overlayPath;
  }

  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  async createThumbnail(videoPath, outputPath, time = "00:00:01") {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [time],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: "320x240",
        })
        .on("end", () => resolve(outputPath))
        .on("error", reject);
    });
  }
}

module.exports = VideoProcessor;
