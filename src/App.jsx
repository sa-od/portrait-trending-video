import React, { useState } from "react";
import Header from "./components/Header";
import UploadSection from "./components/UploadSection";
import TitlesSection from "./components/TitlesSection";
import PreviewSection from "./components/PreviewSection";
import MessageModal from "./components/MessageModal";

function App() {
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [uploadedVideoInfo, setUploadedVideoInfo] = useState(null);
  const [titles, setTitles] = useState(["", "", ""]);
  const [colors, setColors] = useState(["white", "white", "white"]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", body: "" });

  const showModal = (title, body) => {
    setModalContent({ title, body });
    setIsModalOpen(true);
  };

  const hideModal = () => {
    setIsModalOpen(false);
  };

  const handleVideoUpload = (file, videoInfo) => {
    console.log("dd", file, videoInfo);
    setUploadedVideoFile(file);
    setUploadedVideoInfo(videoInfo);
  };

  const handleTitleChange = (index, title) => {
    const newTitles = [...titles];
    newTitles[index] = title;
    setTitles(newTitles);
  };

  const handleColorChange = (index, color) => {
    const newColors = [...colors];
    newColors[index] = color;
    setColors(newColors);
  };

  const handleAITitlesGenerated = (aiTitles) => {
    setTitles(aiTitles);
  };

  return (
    <div className="bg-gray-50 text-gray-900 antialiased min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <Header />

        <main className="max-w-7xl mx-auto space-y-8">
          <UploadSection
            onVideoUpload={handleVideoUpload}
            uploadedVideoFile={uploadedVideoFile}
          />

          <TitlesSection
            titles={titles}
            colors={colors}
            onTitleChange={handleTitleChange}
            onColorChange={handleColorChange}
            onAITitlesGenerated={handleAITitlesGenerated}
            isEnabled={!!uploadedVideoFile}
          />

          <PreviewSection
            uploadedVideoFile={uploadedVideoFile}
            uploadedVideoInfo={uploadedVideoInfo}
            titles={titles}
            colors={colors}
            onShowModal={showModal}
            isEnabled={!!uploadedVideoFile}
          />
        </main>

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>&copy; 2024 Video Variations Inc. All Rights Reserved.</p>
        </footer>
      </div>

      <MessageModal
        isOpen={isModalOpen}
        title={modalContent.title}
        body={modalContent.body}
        onClose={hideModal}
      />
    </div>
  );
}

export default App;
