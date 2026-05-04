import { ReactNode } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface Props {
  cameraStatus: "idle" | "loading" | "ready" | "error";
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

const STATUS = {
  idle:    { label: "Camera off", color: "text-white/60",        icon: CameraOff },
  loading: { label: "Starting…",  color: "text-yellow-300",      icon: Loader2  },
  ready:   { label: "Camera on",  color: "text-emerald-400",     icon: Camera   },
  error:   { label: "No camera",  color: "text-red-400",         icon: CameraOff },
} as const;

export const TopNavBar = ({ cameraStatus, left, center, right }: Props) => {
  const s = STATUS[cameraStatus];
  const Icon = s.icon;
  return (
    <header className="pointer-events-auto fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="text-base">✋</span>
          <span className="hidden sm:inline">Gesture Studio</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] ${s.color}`}>
          <Icon className={`h-3 w-3 ${cameraStatus === "loading" ? "animate-spin" : ""}`} />
          <span>{s.label}</span>
        </div>
        {left}
        <div className="mx-auto flex items-center gap-2">{center}</div>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
};
