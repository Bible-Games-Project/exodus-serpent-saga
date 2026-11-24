// node gen.mjs out.png "prompt" ref1.png [ref2.png...]  — gpt-image-1.5 edit, high, 1024x1536, transparent
import fs from "fs";
const [out, prompt, ...refs] = process.argv.slice(2);
const fd = new FormData();
fd.append("model", "gpt-image-1.5");
fd.append("prompt", prompt);
fd.append("size", "1024x1536");
fd.append("quality", "high");
fd.append("background", "transparent");
fd.append("output_format", "png");
for (const r of refs) fd.append("image[]", new Blob([fs.readFileSync(r)], { type: "image/png" }), r.split("/").pop());
const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
const j = await res.json();
if (!res.ok) { console.error(res.status, JSON.stringify(j).slice(0, 500)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, "base64"));
console.log("ok", out, JSON.stringify(j.usage ?? {}));
