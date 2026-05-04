import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, Theme } from "@/lib/themes";

interface Props {
  currentId: string;
  onPick: (theme: Theme) => void;
}

export const ThemePicker = ({ currentId, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === currentId) ?? THEMES[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.emoji} {current.name}</span>
          <span className="sm:hidden">{current.emoji}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-72 overflow-y-auto p-2">
        <div className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
          {THEMES.length} themes
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => {
            const active = t.id === currentId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { onPick(t); setOpen(false); }}
                className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"
                }`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-white/10"
                  style={{
                    background: `linear-gradient(135deg, hsl(${t.primary}), hsl(${t.accent}))`,
                  }}
                />
                <span className="flex-1 truncate">
                  {t.emoji} {t.name}
                </span>
                {active && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
