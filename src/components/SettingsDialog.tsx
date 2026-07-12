import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [settings, update] = useSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your Exodus Survivors experience.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <Row label="Language" hint="More languages coming soon.">
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={settings.language}
              onChange={() => {}}
            >
              <option value="en">English</option>
            </select>
          </Row>
          <Row label="Volume" hint="Toggle audio (sounds coming in a future update).">
            <Switch checked={settings.volume} onCheckedChange={(v) => update({ volume: v })} />
          </Row>
          <Row label="Game Dev Mode" hint="Reserved for future debugging tools.">
            <Switch checked={settings.devMode} onCheckedChange={(v) => update({ devMode: v })} />
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}
