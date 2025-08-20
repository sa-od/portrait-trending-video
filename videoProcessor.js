const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

class VideoProcessor {
  constructor() {
    this.setupFFmpeg();
  }

  setupFFmpeg() {
    // Set FFmpeg path for Windows
    if (process.platform === 'win32') {
      // You'll need to install FFmpeg and set the path
      // ffmpeg.setFfmpegPath('C:\\path\\to\\ffmpeg.exe');
      // ffmpeg.setFfprobePath('C:\\path\\to\\ffprobe.exe');
    }
  }

  async generateVideoWithTitles(inputPath, outputPath, titles, colors) {
    return new Promise((resolve, reject) => {
      try {
        let command = ffmpeg(inputPath);

        // Add title overlays for each variation
        titles.forEach((title, index) => {
          const color = colors[index] || 'white';
          const yPosition = 50 + (index * 80); // Stack titles vertically
          
          command = command.videoFilters([
            {
              filter: 'drawtext',
              options: {
                text: title,
                fontsize: 48,
                fontcolor: color,
                x: '(w-text_w)/2', // Center horizontally
                y: yPosition,
                font: 'Arial-Bold',
                shadowcolor: 'black',
                shadowx: 2,
                shadowy: 2
              }
            }
          ]);
        });

        command
          .outputOptions([
            '-c:v libx264',        // Video codec
            '-c:a aac',            // Audio codec
            '-preset fast',        // Encoding preset
            '-crf 23',             // Quality setting
            '-movflags +faststart' // Web optimization
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on('end', () => {
            console.log('Video processing completed');
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
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

    const overlayPath = path.join(__dirname, 'temp', `overlay-${Date.now()}.svg`);
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

  async createThumbnail(videoPath, outputPath, time = '00:00:01') {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [time],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x240'
        })
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }
}

module.exports = VideoProcessor;
