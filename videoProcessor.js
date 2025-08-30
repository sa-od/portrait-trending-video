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

  // Get video dimensions to calculate appropriate font size
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

  // Calculate font size based on video height (10% of height)
  calculateFontSize(videoHeight, percentage = 0.1) {
    // FFmpeg font size is roughly 0.7 times the actual pixel height of text
    // So we multiply by 1.4 to compensate
    return Math.round(videoHeight * percentage * 1.4);
  }

  async generateVideoWithTitles(inputPath, outputPath, titles, colors) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get video dimensions first
        const { width, height } = await this.getVideoDimensions(inputPath);
        const fontSize = this.calculateFontSize(height);

        // Calculate line height (12% of video height to give some spacing)
        const lineHeight = Math.round(height * 0.12);

        // Build the drawtext filter string for all titles
        const drawtextFilters = titles
          .map((title, index) => {
            const color = colors[index] || "white";
            const yPosition = Math.round(height * 0.05) + index * lineHeight; // Start at 5% from top

            // Escape special characters properly for FFmpeg
            const escapedTitle = title
              .replace(/'/g, "\\'")
              .replace(/:/g, "\\:")
              .replace(/,/g, "\\,");

            return `drawtext=text='${escapedTitle}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPosition}:fontfile=/System/Library/Fonts/Arial.ttf:shadowcolor=black@0.8:shadowx=4:shadowy=4:box=1:boxcolor=black@0.3:boxborderw=10`;
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
            console.log(
              `Video dimensions: ${width}x${height}, Font size: ${fontSize}`
            );
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

  // Helper function to break long titles into multiple lines
  breakTitleIntoLines(title, maxCharsPerLine = 20) {
    const words = title.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      // If adding this word would exceed the limit, start a new line
      if (
        currentLine.length + word.length + 1 > maxCharsPerLine &&
        currentLine.length > 0
      ) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += (currentLine.length > 0 ? " " : "") + word;
      }
    }

    // Add the last line
    if (currentLine.length > 0) {
      lines.push(currentLine.trim());
    }

    return lines;
  }

  async generateSingleTitleVideo(inputPath, outputPath, title, color) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get video dimensions first
        const { width, height } = await this.getVideoDimensions(inputPath);
        const fontSize = this.calculateFontSize(height, 0.12); // Slightly smaller to accommodate multiple lines

        // Break title into lines to prevent overflow
        const maxCharsPerLine = Math.floor(width / (fontSize * 0.6)); // Estimate characters per line
        const titleLines = this.breakTitleIntoLines(
          title,
          Math.max(maxCharsPerLine, 15)
        );

        // Calculate line height and starting Y position (top of video)
        const lineHeight = fontSize * 1.2; // 20% spacing between lines
        const startY = Math.round(height * 0.05); // Start at 5% from top

        // Create drawtext filters for each line
        const drawtextFilters = titleLines
          .map((line, index) => {
            const yPosition = startY + index * lineHeight;

            // Escape special characters properly for FFmpeg
            const escapedLine = line
              .replace(/'/g, "\\'")
              .replace(/:/g, "\\:")
              .replace(/,/g, "\\,");

            // No background box, positioned at top with strong shadow and border
            return `drawtext=text='${escapedLine}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPosition}:fontfile=/System/Library/Fonts/Arial Black.ttf:shadowcolor=black@0.9:shadowx=4:shadowy=4:borderw=3:bordercolor=black`;
          })
          .join(",");

        let command = ffmpeg(inputPath);

        // Apply title overlays
        command = command.videoFilters(drawtextFilters);

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
            console.log(
              `Video dimensions: ${width}x${height}, Font size: ${fontSize}`
            );
            console.log(
              `Title broken into ${titleLines.length} lines:`,
              titleLines
            );
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

  // Alternative method with even more control over text styling and line breaking
  async generateSingleTitleVideoEnhanced(
    inputPath,
    outputPath,
    title,
    color,
    options = {}
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const { width, height } = await this.getVideoDimensions(inputPath);

        const {
          fontSizePercentage = 0.12, // 12% of video height
          position = "top", // 'top', 'center', 'bottom'
          fontWeight = "black", // 'bold', 'black', 'heavy'
          strokeWidth = 3,
          strokeColor = "black",
          shadowStrength = 0.9,
          shadowOffset = 4,
          backgroundBox = false, // Disabled by default
          backgroundOpacity = 0.4,
          maxCharsPerLine = null, // Auto-calculate if null
        } = options;

        const fontSize = this.calculateFontSize(height, fontSizePercentage);

        // Calculate max characters per line if not provided
        const charsPerLine =
          maxCharsPerLine || Math.floor(width / (fontSize * 0.6));
        const titleLines = this.breakTitleIntoLines(
          title,
          Math.max(charsPerLine, 15)
        );

        // Calculate line height and starting Y position
        const lineHeight = fontSize * 1.2;
        let startY;

        if (position === "top") {
          startY = Math.round(height * 0.05); // 5% from top
        } else if (position === "bottom") {
          startY =
            height - titleLines.length * lineHeight - Math.round(height * 0.05); // 5% from bottom
        } else {
          // center
          startY = (height - titleLines.length * lineHeight) / 2;
        }

        // Create drawtext filters for each line
        const drawtextFilters = titleLines
          .map((line, index) => {
            const yPosition = startY + index * lineHeight;

            const escapedLine = line
              .replace(/'/g, "\\'")
              .replace(/:/g, "\\:")
              .replace(/,/g, "\\,");

            // Build enhanced filter with all styling options
            let filter = `drawtext=text='${escapedLine}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPosition}`;

            // Add font weight
            if (fontWeight === "black") {
              filter += `:fontfile=/System/Library/Fonts/Arial Black.ttf`;
            } else if (fontWeight === "bold") {
              filter += `:fontfile=/System/Library/Fonts/Arial Bold.ttf`;
            }

            // Add shadow
            filter += `:shadowcolor=black@${shadowStrength}:shadowx=${shadowOffset}:shadowy=${shadowOffset}`;

            // Add stroke/border
            if (strokeWidth > 0) {
              filter += `:borderw=${strokeWidth}:bordercolor=${strokeColor}`;
            }

            // Add background box only if explicitly enabled
            if (backgroundBox) {
              filter += `:box=1:boxcolor=black@${backgroundOpacity}:boxborderw=${Math.round(
                fontSize * 0.2
              )}`;
            }

            return filter;
          })
          .join(",");

        let command = ffmpeg(inputPath);
        command = command.videoFilters(drawtextFilters);

        command
          .outputOptions([
            "-c:v libx264",
            "-c:a aac",
            "-preset fast",
            "-crf 23",
            "-movflags +faststart",
          ])
          .output(outputPath)
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
            console.log(
              `Enhanced styling - Font size: ${fontSize}, Position: ${position}`
            );
            console.log(
              `Title broken into ${titleLines.length} lines:`,
              titleLines
            );
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

// Usage Examples:
/*
const processor = new VideoProcessor();

// Example 1: Simple single title at top, no background, with line breaking
processor.generateSingleTitleVideo(
  'input.mp4',
  'output-single.mp4',
  'This is a Long Title That Will Break Into Multiple Lines',
  'white'
);

// Example 2: Enhanced single title with full control, positioned at top
processor.generateSingleTitleVideoEnhanced(
  'input.mp4',
  'output-enhanced.mp4',
  'Another Very Long Title That Needs to Wrap to Multiple Lines for Better Display',
  'yellow',
  {
    fontSizePercentage: 0.10, // 10% of video height per line
    position: 'top', // Position at top
    fontWeight: 'black',
    strokeWidth: 3,
    strokeColor: 'black',
    shadowStrength: 0.9,
    shadowOffset: 4,
    backgroundBox: false, // No background box
    maxCharsPerLine: 25 // Force line break after 25 characters
  }
);

// Example 3: Multiple titles (if still needed)
processor.generateVideoWithTitles(
  'input.mp4',
  'output-multiple.mp4',
  ['Title 1', 'Title 2'],
  ['red', 'blue']
);
*/
