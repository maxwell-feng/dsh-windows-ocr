// Standalone pipeline test: mounts the plugin on a mock cordis context and
// verifies the capability shim, the image->OCR rewrite, vision passthrough,
// fail-closed missing-attachment handling, and unload restore.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { apply } from "../src/index.ts";

const MOCK = fileURLToPath(new URL("./mock-ocr.ps1", import.meta.url));

function makeCtx(llm: any, attachments: any) {
  let disposePlugin: any = null;
  let preStepListener: any = null;
  const ctx = {
    get(name: string) {
      return name === "llm" ? llm : name === "attachments" ? attachments : undefined;
    },
    logger: { warn: () => {} },
    on(name: string, listener: any) {
      if (name === "agent/pre-step") preStepListener = listener;
      return () => {};
    },
    effect(factory: any) {
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

async function runStep(listener: any, messages: any, agent: any = {}) {
  const decision = await listener(
    { agent, messages, turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: "enter", messages }),
  );
  return decision.messages;
}

function collectText(messages: any) {
  const seen: string[] = [];
  for (const message of messages) {
    for (const block of message.content ?? []) {
      seen.push(block.type === "text" ? block.text : `[${block.type}]`);
    }
  }
  return seen.join("\n");
}

function hasImage(messages: any) {
  return messages.some((m: any) => (m.content ?? []).some((b: any) => b?.type === "image"));
}

test("dsh-windows-ocr pipeline suite", async () => {
  const origResolve = async () => ({ inputModalities: ["text"] });
  const origList = async () => [{ id: "m", inputModalities: ["text"] }];
  const llm = {
    resolveModelInfo: origResolve,
    listModels: origList,
  };
  const attachments = {
    async readImage(ref: any) {
      return { ref, data: new Uint8Array([1, 2, 3]) };
    },
  };
  const { ctx, preStep, dispose } = makeCtx(llm, attachments);

  apply(ctx as any, { language: "en-US", ocrScript: MOCK });
  const listener = preStep();
  assert.equal(typeof listener, "function", "plugin registered an agent/pre-step listener");

  // shim
  const info = await llm.resolveModelInfo();
  assert.ok(info.inputModalities.includes("image"), "resolveModelInfo shim adds image");
  const models = await llm.listModels();
  assert.ok(models[0].inputModalities.includes("image"), "listModels shim adds image");

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
  assert.ok(!hasImage(first), "pre-step messages contain no image block");
  assert.ok(text.includes("Hello OCR 123"), "pre-step messages contain OCR text");
  assert.ok(text.includes("<image_ocr"), "OCR tag present");
  assert.ok(!text.includes('name="'), "OCR tag has no filename attribute");

  // cache
  const second = await runStep(listener, messages, {
    options: { provider: "p", model: "m" },
  });
  assert.equal(collectText(second), text, "cache returns the same OCR text");

  // missing attachment is fail-closed
  {
    const llmMissing = {
      resolveModelInfo: async () => ({ inputModalities: ["text"] }),
      listModels: async () => [],
    };
    const { ctx: ctxMissing, preStep: preStepMissing, dispose: disposeMissing } =
      makeCtx(llmMissing, attachments);
    apply(ctxMissing as any, { ocrScript: MOCK });
    const missing = await runStep(preStepMissing(), [
      { role: "user", content: [{ type: "image" }] },
    ]);
    const missingText = collectText(missing);
    assert.ok(!hasImage(missing), "missing attachment leaves no image block");
    assert.ok(missingText.includes("missing attachment"), "missing attachment yields refusal text");
    disposeMissing();
  }

  // default: vision models also OCR
  {
    const llmVisionDefault = {
      resolveModelInfo: async () => ({ inputModalities: ["text", "image"] }),
      listModels: async () => [],
    };
    const { ctx: ctxVd, preStep: preStepVd, dispose: disposeVd } =
      makeCtx(llmVisionDefault, attachments);
    apply(ctxVd as any, { ocrScript: MOCK });
    const vision = await runStep(preStepVd(), messages, {
      options: { provider: "v", model: "vision" },
    });
    const visionText = collectText(vision);
    assert.ok(!hasImage(vision) && visionText.includes("<image_ocr"), "default passthrough=false OCRs vision models");
    disposeVd();
  }

  // opt-in vision passthrough
  {
    const llm2 = {
      resolveModelInfo: async () => ({ inputModalities: ["text", "image"] }),
      listModels: async () => [],
    };
    const { ctx: ctx2, preStep: preStep2, dispose: dispose2 } = makeCtx(llm2, attachments);
    apply(ctx2 as any, { ocrScript: MOCK, passthrough: true });
    const kept = await runStep(preStep2(), messages, {
      session: { requestHeader: () => ({ config: { provider: "v", model: "vision" } }) },
    });
    assert.ok(hasImage(kept), "vision passthrough keeps image block");
    dispose2();
  }

  // passthrough=true still OCRs text-only models
  {
    const llm3 = {
      resolveModelInfo: origResolve,
      listModels: origList,
    };
    const { ctx: ctx3, preStep: preStep3, dispose: dispose3 } = makeCtx(llm3, attachments);
    apply(ctx3 as any, { ocrScript: MOCK, passthrough: true });
    const ocr = await runStep(preStep3(), messages, {
      session: { requestHeader: () => ({ config: { provider: "p", model: "m" } }) },
    });
    const ocrText = collectText(ocr);
    assert.ok(!hasImage(ocr) && ocrText.includes("<image_ocr"), "passthrough=true still OCRs text-only models");
    dispose3();
  }

  // reject decisions pass through untouched
  {
    const { ctx: ctxR, preStep: preStepR, dispose: disposeR } = makeCtx(llm, attachments);
    apply(ctxR as any, { ocrScript: MOCK });
    const decision = await preStepR()(
      { agent: {}, messages, turn: 1, step: 1, signal: new AbortController().signal },
      () => Promise.resolve({ kind: "reject" }),
    );
    assert.equal(decision.kind, "reject", "reject decision passes through untouched");
    disposeR();
  }

  // unload restores originals
  dispose();
  assert.equal(llm.resolveModelInfo, origResolve, "unload restores resolveModelInfo");
  assert.equal(llm.listModels, origList, "unload restores listModels");
});
