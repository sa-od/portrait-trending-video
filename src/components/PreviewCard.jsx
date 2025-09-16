import React, { useState, useRef, useEffect } from "react";
import { useApi } from "../hooks/useApi";

const PreviewCard = ({
  index,
  title,
  color,
  videoFile,
  videoInfo,
  onShowModal,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const videoRef = useRef(null);
  const { generateIndividualVideo, downloadVideo } = useApi();

  useEffect(() => {
    if (videoFile && videoRef.current) {
      const videoUrl = URL.createObjectURL(videoFile);
      videoRef.current.src = videoUrl;
      videoRef.current
        .play()
        .catch((e) => console.error("Autoplay was prevented:", e));
    }
  }, [videoFile]);

  const handleGenerate = async () => {
    if (!videoInfo || !videoFile) {
      onShowModal("Error", "Please upload a video first.");
      return;
    }

    if (!title.trim()) {
      onShowModal("Error", `Please enter a title for Video ${index + 1}.`);
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateIndividualVideo({
        videoFilename: videoInfo.video.filename,
        title: title.trim(),
        color: color,
        videoIndex: index,
      });

      // Download the generated video immediately
      await downloadVideo(result);

      onShowModal(
        "Success",
        `Video ${index + 1} generated and downloaded successfully!`
      );
    } catch (error) {
      console.error("Video generation error:", error);
      onShowModal("Error", "Failed to generate video. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="text-center">
      <div className="relative bg-black rounded-lg overflow-hidden shadow-md mb-4">
        <video
          ref={videoRef}
          className="w-full h-auto"
          muted
          loop
          playsInline
        />
        <div className="absolute top-[6%] left-0 w-full text-center px-4 transition-all duration-300">
          <span
            className="text-5xl font-black uppercase"
            style={{
              color: color,
              textShadow: "3px 3px 10px rgba(0, 0, 0, 0.9)",
              lineHeight: title.length > 15 ? "0.9" : "1.2",
            }}
          >
            {title}
          </span>
        </div>
      </div>

      <p className="text-center mb-4 font-medium text-gray-700">
        Variation {index + 1}
      </p>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-indigo-500/30 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 w-full"
      >
        {isGenerating ? "Generating..." : "Generate & Download"}
      </button>

      <p className="text-sm text-gray-600 mt-2 font-medium">
        {title || "Enter title first"}
      </p>
    </div>
  );
};

export default PreviewCard;
