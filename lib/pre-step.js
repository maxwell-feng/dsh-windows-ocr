import { MISSING_ATTACHMENT_TEXT } from "./config.js";
export function hasImageBlock(content) {
    return (Array.isArray(content) &&
        content.some((block) => block?.type === "image" ||
            (block?.type === "tool-result" && hasImageBlock(block.content))));
}
export function currentRoute(agent) {
    const config = agent.session?.requestHeader?.()?.config;
    if (config &&
        typeof config.provider === "string" && config.provider &&
        typeof config.model === "string" && config.model) {
        return { provider: config.provider, model: config.model };
    }
    const options = agent.options;
    return {
        provider: typeof options?.provider === "string" && options.provider
            ? options.provider
            : undefined,
        model: typeof options?.model === "string" && options.model
            ? options.model
            : undefined,
    };
}
export async function rewriteContent(content, ocrEngine) {
    let out = null;
    for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (block?.type === "image") {
            if (!out)
                out = [...content];
            const ref = block.attachment;
            if (!ref) {
                out[i] = {
                    type: "text",
                    text: `<image_ocr>\n${MISSING_ATTACHMENT_TEXT}\n</image_ocr>`,
                };
                continue;
            }
            out[i] = {
                type: "text",
                text: `<image_ocr>\n${await ocrEngine.ocrText(ref)}\n</image_ocr>`,
            };
        }
        else if (block?.type === "tool-result" && block.content && hasImageBlock(block.content)) {
            if (!out)
                out = [...content];
            out[i] = { ...block, content: await rewriteContent(block.content, ocrEngine) };
        }
    }
    return out ?? content;
}
export async function rewriteMessages(messages, agent, passthrough, nativeImageSupport, ocrEngine) {
    if (!Array.isArray(messages))
        return messages;
    if (passthrough) {
        const route = currentRoute(agent);
        if (route.provider && route.model && (await nativeImageSupport(route.provider, route.model))) {
            return messages;
        }
    }
    let out = null;
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message && message.content && hasImageBlock(message.content)) {
            if (!out)
                out = [...messages];
            out[i] = { ...message, content: await rewriteContent(message.content, ocrEngine) };
        }
    }
    return out ?? messages;
}
