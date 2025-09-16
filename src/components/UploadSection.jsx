import React, { useState, useRef } from "react";
import { useApi } from "../hooks/useApi";

const UploadSection = ({ onVideoUpload, uploadedVideoFile }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const fileInputRef = useRef(null);
  const { testConnection, uploadVideo } = useApi();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = () => {
    if (fileInputRef.current.files.length) {
      handleFile(fileInputRef.current.files[0]);
    }
  };

  const handleFile = async (file) => {
    if (!file.type.startsWith("video/")) {
      setUploadStatus("Error: Please select a valid video file.");
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setUploadStatus("Error: File size exceeds 100MB.");
      return;
    }

    try {
      setUploadStatus("Testing connection...");

      // Test API connection first
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error(
          "Cannot connect to server. Please check if the server is running and try again."
        );
      }

      setUploadStatus("Uploading video...");

      // Upload video to backend
      const videoInfo = await uploadVideo(file);

      setUploadStatus(`Successfully uploaded: ${file.name}`);
      onVideoUpload(file, videoInfo);
    } catch (error) {
      console.error("Upload error:", error);

      let errorMessage = "Failed to upload video. Please try again.";

      if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        errorMessage =
          "Network error: Unable to connect to server. Please check your internet connection and try again.";
        setShowTroubleshooting(true);
      } else if (error.message.includes("ERR_BLOCKED_BY_CLIENT")) {
        errorMessage =
          "Request blocked by browser security. Please disable ad blockers or try a different browser.";
        setShowTroubleshooting(true);
      } else if (error.message.includes("CORS")) {
        errorMessage = "Cross-origin request blocked. Please contact support.";
        setShowTroubleshooting(true);
      }

      setUploadStatus(errorMessage);
    }
  };

  return (
    <section className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm">
      <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
        <span className="bg-indigo-600 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">
          1
        </span>
        Upload Your Video
      </h2>

      <div
        className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 hover:border-indigo-500 hover:bg-indigo-50 ${
          isDragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <svg
            className="w-8 h-8 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-gray-500">
            <span className="font-semibold text-indigo-600">
              Click to upload
            </span>{" "}
            or drag and drop
          </p>
          <p className="text-xs text-gray-400">MP4, MOV, or WEBM (Max 100MB)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileInputChange}
        />
      </div>

      <div
        className={`mt-4 text-center text-sm ${
          uploadStatus.includes("Error") ? "text-red-500" : "text-green-500"
        }`}
      >
        {uploadStatus}
      </div>

      {/* Browser Troubleshooting Section */}
      {showTroubleshooting && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            Having trouble uploading?
          </h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <p>
              <strong>For Brave Browser:</strong> Try disabling Brave Shields
              for this site (click the shield icon in the address bar)
            </p>
            <p>
              <strong>For Safari:</strong> Go to Safari &gt; Preferences &gt;
              Privacy and uncheck "Prevent cross-site tracking"
            </p>
            <p>
              <strong>For all browsers:</strong> Disable ad blockers or privacy
              extensions temporarily
            </p>
            <p>
              <strong>Still having issues?</strong> Check the browser console
              (F12) for detailed error messages
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default UploadSection;
