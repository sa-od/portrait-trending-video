import React from "react";
import PreviewCard from "./PreviewCard";

const PreviewSection = ({
  uploadedVideoFile,
  uploadedVideoInfo,
  titles,
  colors,
  onShowModal,
  isEnabled,
}) => {
  return (
    <section
      className={`bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm transition-opacity duration-500 ${
        isEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
      }`}
    >
      <h2 className="text-xl font-semibold text-black mb-6 flex items-center">
        <span className="bg-indigo-600 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">
          3
        </span>
        Preview & Generate
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {titles.map((title, index) => (
          <PreviewCard
            key={index}
            index={index}
            title={title}
            color={colors[index]}
            videoFile={uploadedVideoFile}
            videoInfo={uploadedVideoInfo}
            onShowModal={onShowModal}
          />
        ))}
      </div>
    </section>
  );
};

export default PreviewSection;
