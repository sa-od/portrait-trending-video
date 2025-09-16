import { useCallback } from "react";

export const useApi = () => {
  const getApiBaseUrl = useCallback(() => {
    // If we're on localhost, use localhost:3000
    // if (
    //   window.location.hostname === "localhost" ||
    //   window.location.hostname === "127.0.0.1"
    // ) {
    //   return `http://${window.location.hostname}:3000`;
    // }
    // // For Vercel domains, use the backend API URL
    // if (window.location.hostname.includes("vercel.app")) {
    //   return "https://instareel-backend.vercel.app"; // Update this to your actual backend URL
    // }
    // // For production, use the same origin
    // return window.location.origin;

    return "https://68c9a201d145240a0499f00a--chic-taffy-bf0e46.netlify.app";
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const healthUrl = `${getApiBaseUrl()}/api/health`;
      console.log("Testing API connection to:", healthUrl);
      console.log("Testing API connection to:", healthUrl);
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("API connection successful:", data);
        return true;
      } else {
        console.error("API health check failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("API connection test failed:", error);
      return false;
    }
  }, [getApiBaseUrl]);

  const uploadVideo = useCallback(
    async (file) => {
      console.log("uploadVideo", file);
      const formData = new FormData();
      formData.append("video", file);

      const apiUrl = `${getApiBaseUrl()}/api/upload-video`;
      console.log("Uploading to:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        throw new Error(
          `Failed to upload video: ${response.status} ${errorText}`
        );
      }

      return await response.json();
    },
    [getApiBaseUrl]
  );

  const generateTitles = useCallback(
    async (topic) => {
      const apiUrl = `${getApiBaseUrl()}/api/generate-titles`;
      const payload = { topic };

      let retries = 3;
      let delay = 1000;

      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            return await response.json();
          } else if (response.status === 429 || response.status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            throw new Error(
              `API request failed with status ${response.status}`
            );
          }
        } catch (error) {
          if (i === retries - 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
      throw new Error("AI request failed after multiple retries.");
    },
    [getApiBaseUrl]
  );

  const generateIndividualVideo = useCallback(
    async (data) => {
      const response = await fetch(
        `${getApiBaseUrl()}/api/generate-individual-video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate video");
      }

      return await response.json();
    },
    [getApiBaseUrl]
  );

  const downloadVideo = useCallback(
    async (video) => {
      try {
        const downloadResponse = await fetch(
          `${getApiBaseUrl()}${video.downloadUrl}`
        );
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = video.filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          throw new Error("Failed to download video");
        }
      } catch (error) {
        console.error("Download error:", error);
        throw error;
      }
    },
    [getApiBaseUrl]
  );

  return {
    testConnection,
    uploadVideo,
    generateTitles,
    generateIndividualVideo,
    downloadVideo,
  };
};
