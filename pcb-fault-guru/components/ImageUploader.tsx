
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDragEvents = useCallback((e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e, false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [handleDragEvents, onImageUpload]);

  const dragClasses = isDragging ? 'border-brand-primary bg-gray-700/50' : 'border-gray-600';

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[70vh]">
      <div
        className={`relative flex flex-col items-center justify-center w-full max-w-2xl h-96 border-2 border-dashed ${dragClasses} rounded-lg transition-colors duration-200`}
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
          <p className="mt-4 text-lg font-semibold text-gray-300">
            Drag and drop your PCB image here
          </p>
          <p className="mt-1 text-sm text-gray-500">or</p>
          <label
            htmlFor="file-upload"
            className="mt-2 inline-block cursor-pointer px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md transition-colors"
          >
            Click to upload
          </label>
          <p className="mt-3 text-xs text-gray-500">PNG or JPG (up to 4096px)</p>
        </div>
        <input
          id="file-upload"
          name="file-upload"
          type="file"
          className="sr-only"
          accept="image/png, image/jpeg"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default ImageUploader;