// Standalone pipeline test: mounts the plugin on a mock cordis context and
// verifies the capability shim, the image->OCR rewrite, and vision passthrough.
// Runs the REAL Windows OCR engine (Windows.Media.Ocr via lib/ocr.ps1) on a
// 1x1 PNG, so the full OCR chain is exercised without a harness.
//
// Usage: node test/standalone-test.mjs

import { apply } from "../lib/index.js";

// 1x1 transparent PNG.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let failures = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
}

// --- text-model adapter: image must be replaced with OCR text ---------------
const textAdapter = {
  async *stream(options) {
    const seen = [];
    for (const message of options.messages) {
      for (const block of message.content ?? []) {
        seen.push(block.type === "text" ? block.text : `[${block.type}]`);
      }
    }
    const text = seen.join("\n");
    check("adapter received no image block", !text.includes("[image]"));
    check("OCR tag present", text.includes("<image_ocr"));
    check("OCR placeholder present", text.includes("OCR:"));
    yield { type: "text", text: "ok" };
  },
};
const llm = {
  resolveModelInfo: async () => ({ inputModalities: ["text"] }),
  listModels: async () => [{ id: "m", inputModalities: ["text"] }],
  adapters: new Map([["p", { adapter: textAdapter }]]),
};
const attachments = {
  async readImage() {
    return { ref: { attachmentId: "img1", mediaType: "image/png", bytes: PNG_1X1.length, width: 1, height: 1 }, data: PNG_1X1 };
  },
};
const ctx = {
  get(name) {
    return name === "llm" ? llm : name === "attachments" ? attachments : undefined;
  },
  logger: { warn: (...a) => console.log("WARN:", ...a) },
  on() { return () => {}; },
  effect() { return () => {}; },
};

apply(ctx, { language: "en-US" });

// shim
const info = await llm.resolveModelInfo("p", "m");
check("resolveModelInfo shim adds image", info.inputModalities.includes("image"));
const models = await llm.listModels("p");
check("listModels shim adds image", models[0].inputModalities.includes("image"));

// rewrite path (runs real Windows OCR on the 1x1 PNG)
const messages = [
  { role: "user", content: [
    { type: "text", text: "look" },
    { type: "image", attachment: { attachmentId: "img1", mediaType: "image/png", bytes: PNG_1X1.length, width: 1, height: 1, name: "t.png" } },
  ]},
];
for await (const _c of textAdapter.stream({ provider: "p", model: "m", messages })) {}

// --- vision-model passthrough ------------------------------------------------
const visionAdapter = {
  async *stream(options) {
    const hasImage = options.messages.some((m) =>
      (m.content ?? []).some((b) => b?.type === "image"));
    check("vision passthrough keeps image block", hasImage);
    yield { type: "text", text: "vision ok" };
  },
};
const llm2 = {
  resolveModelInfo: async () => ({ inputModalities: ["text", "image"] }),
  listModels: async () => [],
  adapters: new Map([["v", { adapter: visionAdapter }]]),
};
const ctx2 = {
  ...ctx,
  get: (n) => (n === "llm" ? llm2 : n === "attachments" ? attachments : undefined),
};
apply(ctx2, {});
for await (const _c of visionAdapter.stream({ provider: "v", model: "vision", messages })) {}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
