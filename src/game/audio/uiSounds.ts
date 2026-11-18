// UI sounds for every button / link / tab in the app, from one listener.
//
//   data-sfx="ui.confirm"        sound on click (default "ui.click"; tabs "ui.tab")
//   data-sfx-hover="ui.card"     sound on mouse hover (default "ui.hover")
//   data-sfx="none"              no click sound (the action plays its own)
//
// Range sliders play "ui.slider", checkboxes / switches "ui.toggle".
import { sfx } from "./audioManager";

const CLICKABLE = 'button, a[href], [role="tab"], [role="switch"], .pixel-btn, input[type="checkbox"], select';

function attr(el: Element, name: string): string | null {
  const v = el.getAttribute(name);
  return v === "none" ? "" : v;
}

let installed = false;
export function installUiSounds() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let hovered: Element | null = null;

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = (e.target as Element | null)?.closest?.(CLICKABLE) ?? null;
    if (el === hovered) return;
    hovered = el;
    if (!el || (el as HTMLButtonElement).disabled) return;
    const id = attr(el, "data-sfx-hover") ?? "ui.hover";
    if (id) sfx(id);
  }, true);

  document.addEventListener("click", (e) => {
    const el = (e.target as Element | null)?.closest?.(CLICKABLE) ?? null;
    if (!el) return;
    let id = attr(el, "data-sfx");
    if (id == null) {
      const role = el.getAttribute("role");
      id = role === "tab" ? "ui.tab" : role === "switch" || (el as HTMLInputElement).type === "checkbox" ? "ui.toggle" : "ui.click";
    }
    if (id) sfx(id);
  }, true);

  let lastSlider = 0;
  document.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | null;
    if (el?.type !== "range" || el.getAttribute("data-sfx") === "none") return;
    const now = performance.now();
    if (now - lastSlider < 90) return;
    lastSlider = now;
    sfx("ui.slider");
  }, true);
}
