import React from "react";

const TitleInput = ({ index, title, color, onTitleChange, onColorChange }) => {
  const colorOptions = [
    { value: "white", label: "White", class: "text-white shadow-gray-400" },
    { value: "red", label: "Red", class: "text-red-500 shadow-red-500" },
    {
      value: "yellow",
      label: "Yellow",
      class: "text-yellow-400 shadow-yellow-400",
    },
    { value: "lime", label: "Lime", class: "text-lime-400 shadow-lime-400" },
    { value: "black", label: "Black", class: "text-black shadow-black" },
  ];

  const handleTitleChange = (e) => {
    onTitleChange(index, e.target.value);
  };

  const handleColorChange = (e) => {
    if (e.target.type === "radio") {
      onColorChange(index, e.target.value);
    } else if (e.target.type === "color") {
      onColorChange(index, e.target.value);
    }
  };

  return (
    <div>
      <label
        htmlFor={`title${index + 1}`}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Title Variation {index + 1}
      </label>
      <input
        type="text"
        id={`title${index + 1}`}
        name={`title${index + 1}`}
        className="w-full bg-white border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
        placeholder={`e.g., ${
          index === 0
            ? "OUR WEEKEND ADVENTURE"
            : index === 1
            ? "EXPLORING THE MOUNTAINS"
            : "UNFORGETTABLE MEMORIES"
        }`}
        value={title}
        onChange={handleTitleChange}
      />

      <div className="flex items-center space-x-3 mt-3">
        <span className="text-sm font-medium text-gray-500">Color:</span>

        {colorOptions.map((option) => (
          <label key={option.value} className="flex items-center">
            <input
              type="radio"
              name={`color${index + 1}`}
              value={option.value}
              className={`color-radio ${option.class}`}
              checked={color === option.value}
              onChange={handleColorChange}
            />
          </label>
        ))}

        <div className="flex flex-col items-center">
          <input
            type="color"
            name={`custom-color${index + 1}`}
            className="custom-color-picker w-8 h-8 rounded border-2 border-gray-300 cursor-pointer hover:border-indigo-500 transition-colors"
            value={color.startsWith("#") ? color : "#ffffff"}
            onChange={handleColorChange}
            title="Custom color picker"
          />
          <span className="text-xs text-gray-400 mt-1">Custom</span>
        </div>
      </div>
    </div>
  );
};

export default TitleInput;
