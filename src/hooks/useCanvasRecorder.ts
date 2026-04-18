import { useCallback, useRef, useState } from "react";

export function useCanvasRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [supported] = useState(() => typeof MediaRecorder !== "undefined");

  const start = useCallback(() => {
    if (!supported) return;
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const stream = (canvas as HTMLCanvasElement).captureStream(60);
    const mimeCandidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gesture-particles-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setIsRecording(true);
  }, [supported]);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (!r) return;
    r.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  return { isRecording, toggle, supported };
}
