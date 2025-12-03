import React from 'react';
import '../styles/SuccessModal.css';

const SuccessModal = ({ message, onClose, type = "success" }) => {
  const isError = type === "error";
  return (
    <div className={`success-modal ${isError ? 'error-modal' : ''}`}>
      <div className="success-modal-content">
        <div className="success-logo">
          {isError ? (
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D32F2F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2E7D32"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <polyline points="9 15 12 18 22 8" />
            </svg>
          )}
        </div>
        <div className="success-title">
          {isError ? "Error!" : "Success!"}
        </div>
        <div className="success-message">{message}</div>
        <button className="close-modal-button" onClick={onClose}>
          {isError ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D32F2F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2E7D32"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              {/* Arrow flipped to point right */}
              <polyline points="12 8 16 12 12 16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;