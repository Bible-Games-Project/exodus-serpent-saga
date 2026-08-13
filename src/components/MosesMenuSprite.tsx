import homeMoses from "@/assets/moses-home.png.asset.json";

/**
 * Home / Main Menu Moses: the supplied pixel-art PNG, shown exactly as provided
 * (never redrawn or recoloured), scaled with `image-rendering: pixelated` and
 * given a slow idle float by the caller.
 */
export function MosesMenuSprite({ zoom = 3, className }: { zoom?: number; className?: string }) {
  // The artwork is 1024x1536; zoom keeps the old call-sites meaningful.
  const height = zoom * 112;
  return (
    <img
      src={homeMoses.url}
      alt="Moses holding his shepherd's staff"
      className={className}
      style={{ height, width: "auto", imageRendering: "pixelated" }}
    />
  );
}
