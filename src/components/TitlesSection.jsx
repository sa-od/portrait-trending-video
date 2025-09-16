import React, { useState } from "react";
import TitleInput from "./TitleInput";
import AIGeneration from "./AIGeneration";

const TitlesSection = ({
  titles,
  colors,
  onTitleChange,
  onColorChange,
  onAITitlesGenerated,
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
          2
        </span>
        Enter Title Variations
      </h2>

      <AIGeneration onTitlesGenerated={onAITitlesGenerated} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {titles.map((title, index) => (
          <TitleInput
            key={index}
            index={index}
            title={title}
            color={colors[index]}
            onTitleChange={onTitleChange}
            onColorChange={onColorChange}
          />
        ))}
      </div>
    </section>
  );
};

export default TitlesSection;
