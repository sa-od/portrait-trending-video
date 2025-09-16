import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

const AIGeneration = ({ onTitlesGenerated }) => {
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const { generateTitles } = useApi();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setStatus("Please enter a topic for your video.");
      return;
    }

    setIsLoading(true);
    setStatus("");

    try {
      const result = await generateTitles(topic.trim());
      if (result && result.titles && result.titles.length >= 3) {
        onTitlesGenerated(result.titles.slice(0, 3));
        setStatus("");
      } else {
        throw new Error("AI did not return the expected format.");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setStatus("Failed to generate titles. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
      <label
        htmlFor="ai-topic"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Describe your video topic to generate titles with AI:
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          id="ai-topic"
          className="flex-grow bg-white border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
          placeholder="e.g., A travel video about mountains"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-5 rounded-lg transition-all duration-300 shadow-sm transform hover:scale-105 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Generating...
            </>
          ) : (
            "Generate with AI"
          )}
        </button>
      </div>
      {status && <div className="mt-2 text-xs text-red-500">{status}</div>}
    </div>
  );
};

export default AIGeneration;
