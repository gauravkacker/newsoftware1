"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoUploaded: (photoUrl: string) => void;
  patientName: string;
}

export function PhotoUpload({ currentPhotoUrl, onPhotoUploaded, patientName }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload from computer
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    await uploadPhoto(objectUrl);
  };

  // Start camera
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Could not access camera. Please check permissions.");
      setShowCamera(false);
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoUrl = canvas.toDataURL("image/jpeg", 0.8);
        stopCamera();
        setPreview(photoUrl);
        uploadPhoto(photoUrl);
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  // Upload photo (compress and save)
  const uploadPhoto = async (photoUrl: string) => {
    setIsUploading(true);
    try {
      // Compress image
      const compressed = await compressImage(photoUrl, 200, 200, 0.7);
      onPhotoUploaded(compressed);
      setPreview(null);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    if (confirm("Are you sure you want to remove the profile photo?")) {
      onPhotoUploaded("");
    }
  };

  // Display current photo or preview
  const displayUrl = preview || currentPhotoUrl;

  return (
    <div className="relative">
      {/* Current/Preview Photo */}
      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt={`${patientName}'s photo`}
            className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
          {/* Camera Modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <Card className="p-4 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Take Photo</h3>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-gray-100"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 mt-4">
                  <Button variant="primary" onClick={capturePhoto}>
                    Capture
                  </Button>
                  <Button variant="secondary" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="h-32 w-32 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-lg">
          <span className="text-blue-600 font-medium text-3xl">
            {patientName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
      </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {!displayUrl ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              📷 Upload Photo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={startCamera}
            >
              📸 Take Photo
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              🔄 Change Photo
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemovePhoto}
            >
              🗑️ Remove
            </Button>
          </>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Helper function to compress image
function compressImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
