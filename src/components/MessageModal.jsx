import React, { useEffect } from "react";

const MessageModal = ({ isOpen, title, body, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-gray-200 modal-content transform scale-95"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-black">{title}</h3>
        <p className="mt-2 text-gray-600">{body}</p>
        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
