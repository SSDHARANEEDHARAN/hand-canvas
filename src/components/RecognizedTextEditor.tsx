import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  loading: boolean;
  initialText: string;
  error?: string;
  onClose: () => void;
  onCopy: (text: string) => void;
}

export const RecognizedTextEditor = ({ open, loading, initialText, error, onClose, onCopy }: Props) => {
  const [text, setText] = useState(initialText);

  // Reset text whenever a new initial value comes in
  if (open && initialText !== undefined && text !== initialText && !loading && text === "") {
    setText(initialText);
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(520px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-sm font-semibold">Recognized handwriting</div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recognizing strokes…
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <Textarea
              value={text || initialText}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="font-mono"
              placeholder="(no text recognized)"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button
            size="sm"
            disabled={loading || !!error}
            onClick={() => {
              onCopy(text || initialText);
              onClose();
            }}
          >
            Copy text
          </Button>
        </div>
      </div>
    </div>
  );
};
