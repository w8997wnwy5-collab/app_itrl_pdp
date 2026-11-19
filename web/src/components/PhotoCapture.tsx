import { useEffect, useRef, useState } from "react";
import type { AvatarConfig } from "../../../shared/avatar";
import { fileToImage, guessFromPhoto, toJpegDataUrl } from "../lib/photo";

export interface CapturedPhoto {
  dataUrl: string;
  guess: Partial<AvatarConfig>;
}

/** Selfie with a live camera (with face guide) or from the photo library. */
export function PhotoCapture({ onPhoto }: { onPhoto: (photo: CapturedPhoto) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const openCamera = async (mode: "user" | "environment" = facing) => {
    setError(null);
    if (!canUseCamera) {
      fileRef.current?.click();
      return;
    }
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setFacing(mode);
      setStream(s);
    } catch {
      setError("Non riesco ad aprire la fotocamera: puoi caricare una foto dalla galleria.");
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const mirror = facing === "user";
    const dataUrl = toJpegDataUrl(video, 1024, mirror);
    const guess = guessFromPhoto(video);
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    onPhoto({ dataUrl, guess });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const img = await fileToImage(file);
      onPhoto({ dataUrl: toJpegDataUrl(img, 1024), guess: guessFromPhoto(img) });
    } catch {
      setError("Questa immagine non si apre: prova con un'altra foto (JPG o PNG).");
    }
  };

  return (
    <div className="stack">
      {stream ? (
        <>
          <div className="camera">
            <video ref={videoRef} playsInline muted className={facing === "user" ? "mirror" : undefined} />
            <div className="camera__guide" />
          </div>
          <p className="hint" style={{ textAlign: "center", margin: 0 }}>
            Metti il viso dentro l'ovale, guarda in camera e sorridi 😁
          </p>
          <div className="grid-2">
            <button className="btn btn--ghost" onClick={() => void openCamera(facing === "user" ? "environment" : "user")}>
              🔄 Gira
            </button>
            <button className="btn" onClick={shoot}>
              📸 Scatta
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="btn btn--block" onClick={() => void openCamera()}>
            📸 Scatta un selfie
          </button>
          <button className="btn btn--ghost btn--block" onClick={() => fileRef.current?.click()}>
            🖼️ Scegli dalla galleria
          </button>
        </>
      )}
      {error ? <div className="error-box">{error}</div> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture={canUseCamera ? undefined : "user"}
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
