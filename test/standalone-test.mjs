// Standalone pipeline test: mounts the plugin on a mock cordis context and
// verifies the capability shim, the image->OCR rewrite (through the harness's
// `agent/pre-step` seam), vision passthrough, fail-closed missing-attachment
// handling, and unload restore. OCR runs the REAL powershell.exe with the mock
// script (test/mock-ocr.ps1) via the ocrScript config, so the whole
// spawn/args/temp-file chain is exercised without needing a Windows OCR
// language pack.
//
// Usage: node test/standalone-test.mjs  (Windows with PowerShell)

import { fileURLToPath } from "node:url";
import { apply } from "../lib/index.js";

const MOCK = fileURLToPath(new URL("./mock-ocr.ps1", import.meta.url));

let failures = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
}

function makeCtx(llm, attachments) {
  let disposePlugin = null;
  let preStepListener = null;
  const ctx = {
    get(name) {
      return name === "llm" ? llm : name === "attachments" ? attachments : undefined;
    },
    logger: { warn: (...a) => console.log("WARN:", ...a) },
    on(name, listener) {
      if (name === "agent/pre-step") preStepListener = listener;
      return () => {};
    },
    effect(factory) {
      disposePlugin = factory();
      return () => {};
    },
  };
  return {
    ctx,
    preStep() {
      return preStepListener;
    },
    dispose() {
      if (typeof disposePlugin === "function") disposePlugin();
    },
  };
}

// Run one agent/pre-step dispatch: the listener rewrites the incoming
// `messages` and returns the enter decision the loop would build from.
async function runStep(listener, messages, agent = {}) {
  const decision = await listener(
    { agent, messages, turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: "enter", messages }),
  );
  return decision.messages;
}

function collectText(messages) {
  const seen = [];
  for (const message of messages) {
    for (const block of message.content ?? []) {
      seen.push(block.type === "text" ? block.text : `[${block.type}]`);
    }
  }
  return seen.join("\n");
}

function hasImage(messages) {
  return messages.some((m) => (m.content ?? []).some((b) => b?.type === "image"));
}

// --- text-model: image must be replaced with OCR text -----------------------
const origResolve = async () => ({ inputModalities: ["text"] });
const origList = async () => [{ id: "m", inputModalities: ["text"] }];
const llm = {
  resolveModelInfo: origResolve,
  listModels: origList,
};
const attachments = {
  async readImage(ref) {
    return { ref, data: new Uint8Array([1, 2, 3]) };
  },
};
const { ctx, preStep, dispose } = makeCtx(llm, attachments);

apply(ctx, { language: "en-US", ocrScript: MOCK });
const listener = preStep();
check("plugin registered an agent/pre-step listener", typeof listener === "function");

// shim
const info = await llm.resolveModelInfo("p", "m");
check("resolveModelInfo shim adds image", info.inputModalities.includes("image"));
const models = await llm.listModels("p");
check("listModels shim adds image", models[0].inputModalities.includes("image"));

// rewrite path
const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "look" },
      {
        type: "image",
        attachment: {
          attachmentId: "img1",
          mediaType: "image/png",
          bytes: 3,
          width: 1,
          height: 1,
          name: "secret-path.png",
        },
      },
    ],
  },
];
const first = await runStep(listener, messages, {
  options: { provider: "p", model: "m" },
});
const text = collectText(first);
check("pre-step messages contain no image block", !hasImage(first));
check("pre-step messages contain OCR text", text.includes("Hello OCR 123"));
check("OCR tag present", text.includes("<image_ocr"));
check("OCR tag has no filename attribute", !text.includes('name="'));

// cache: second call must not re-run OCR (same OCR text)
const second = await runStep(listener, messages, {
  options: { provider: "p", model: "m" },
});
check("cache returns the same OCR text", collectText(second) === text);

// --- missing attachment is fail-closed (no raw image left) -----------------
{
  const llmMissing = {
    resolveModelInfo: async () => ({ inputModalities: ["text"] }),
    listModels: async () => [],
  };
  const { ctx: ctxMissing, preStep: preStepMissing, dispose: disposeMissing } =
    makeCtx(llmMissing, attachments);
  apply(ctxMissing, { ocrScript: MOCK });
  const missing = await runStep(preStepMissing(), [
    { role: "user", content: [{ type: "image" }] },
  ]);
  const missingText = collectText(missing);
  check("missing attachment leaves no image block", !hasImage(missing));
  check("missing attachment yields refusal text", missingText.includes("missing attachment"));
  disposeMissing();
}

// --- default: vision models also OCR (passthrough false) -------------------
{
  const llmVisionDefault = {
    resolveModelInfo: async () => ({ inputModalities: ["text", "image"] }),
    listModels: async () => [],
  };
  const { ctx: ctxVd, preStep: preStepVd, dispose: disposeVd } =
    makeCtx(llmVisionDefault, attachments);
  apply(ctxVd, { ocrScript: MOCK });
  const vision = await runStep(preStepVd(), messages, {
    options: { provider: "v", model: "vision" },
  });
  const visionText = collectText(vision);
  check("default passthrough=false OCRs vision models", !hasImage(vision) && visionText.includes("<image_ocr"));
  disposeVd();
}

// --- opt-in vision-model passthrough ----------------------------------------
{
  const llm2 = {
    resolveModelInfo: async () => ({ inputModalities: ["text", "image"] }),
    listModels: async () => [],
  };
  const { ctx: ctx2, preStep: preStep2, dispose: dispose2 } = makeCtx(llm2, attachments);
  apply(ctx2, { ocrScript: MOCK, passthrough: true });
  const kept = await runStep(preStep2(), messages, {
    session: { requestHeader: () => ({ config: { provider: "v", model: "vision" } }) },
  });
  check("vision passthrough keeps image block", hasImage(kept));
  dispose2();
}

// --- passthrough=true still OCRs text-only models ----------------------------
{
  const llm3 = {
    resolveModelInfo: origResolve,
    listModels: origList,
  };
  const { ctx: ctx3, preStep: preStep3, dispose: dispose3 } = makeCtx(llm3, attachments);
  apply(ctx3, { ocrScript: MOCK, passthrough: true });
  const ocr = await runStep(preStep3(), messages, {
    session: { requestHeader: () => ({ config: { provider: "p", model: "m" } }) },
  });
  const ocrText = collectText(ocr);
  check("passthrough=true still OCRs text-only models", !hasImage(ocr) && ocrText.includes("<image_ocr"));
  dispose3();
}

// --- reject decisions pass through untouched --------------------------------
{
  const { ctx: ctxR, preStep: preStepR, dispose: disposeR } = makeCtx(llm, attachments);
  apply(ctxR, { ocrScript: MOCK });
  const decision = await preStepR()(
    { agent: {}, messages, turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: "reject" }),
  );
  check("reject decision passes through untouched", decision.kind === "reject");
  disposeR();
}

// --- unload restores originals ---------------------------------------------
dispose();
check("unload restores resolveModelInfo", llm.resolveModelInfo === origResolve);
check("unload restores listModels", llm.listModels === origList);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
