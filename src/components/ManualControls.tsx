import { TEMPLATE_ORDER, TemplateName } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  template: TemplateName;
  expansion: number;
  hue: number;
  onTemplate: (t: TemplateName) => void;
  onExpansion: (v: number) => void;
  onHue: (v: number) => void;
}

export const ManualControls = ({
  template,
  expansion,
  hue,
  onTemplate,
  onExpansion,
  onHue,
}: Props) => {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-10 flex max-w-[min(640px,92vw)] -translate-x-1/2 flex-col gap-3 rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-white/90 backdrop-blur-md">
      <div className="flex flex-wrap justify-center gap-1.5">
        {TEMPLATE_ORDER.map((t, i) => (
          <Button
            key={t}
            size="sm"
            variant={t === template ? "default" : "secondary"}
            onClick={() => onTemplate(t)}
            className="h-7 px-2.5 text-[11px] capitalize"
            data-testid={`template-${t}`}
          >
            <span className="mr-1 opacity-60">{i + 1}</span>
            {t}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span>Expansion</span>
            <span className="font-mono opacity-70">{expansion.toFixed(2)}</span>
          </span>
          <Slider
            value={[expansion]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(v) => onExpansion(v[0])}
            aria-label="Expansion"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span>Color</span>
            <span
              className="h-3 w-6 rounded"
              style={{ background: `hsl(${Math.round(hue * 360)} 85% 60%)` }}
            />
          </span>
          <Slider
            value={[hue]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(v) => onHue(v[0])}
            aria-label="Color"
          />
        </label>
      </div>
    </div>
  );
};
