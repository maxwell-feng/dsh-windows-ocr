declare module "@deepseek-ai/cordis" {
  interface Events {
    "agent/pre-step"(
      payload: AgentPreStepPayload,
      next: () => Promise<PreStepDecision>,
    ): Promise<PreStepDecision>;
  }
}

export type ModalityInfo = { inputModalities?: string[] };

export interface LlmService {
  resolveModelInfo(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<ModalityInfo | undefined>;
  listModels(provider: string): Promise<Array<{ id: string } & ModalityInfo>>;
}

export interface ImageAttachmentRef {
  attachmentId: string;
  mediaType: string;
  bytes: number;
  width: number;
  height: number;
  name?: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
  attachment?: ImageAttachmentRef;
  content?: ContentBlock[];
  [key: string]: unknown;
}

export interface MessageLike {
  role?: string;
  content?: ContentBlock[];
}

export interface AttachmentStore {
  readImage(
    ref: ImageAttachmentRef,
    signal?: AbortSignal,
  ): Promise<{ ref: ImageAttachmentRef; data: Uint8Array }>;
}

export interface AgentRoute {
  provider?: string;
  model?: string;
}

export interface AgentLike {
  options?: AgentRoute;
  session?: {
    requestHeader?: () => { config?: AgentRoute } | undefined;
  };
}

export interface AgentPreStepPayload {
  agent: AgentLike;
  messages: MessageLike[];
  turn: number;
  step: number;
  signal: AbortSignal;
}

export type PreStepDecision =
  | { kind: "reject" }
  | { kind: "enter"; messages: MessageLike[]; startsRequestSeries?: true };

export interface Config {
  language?: string;
  passthrough?: boolean;
  ocrScript?: string;
  timeoutMs?: number;
  maxCacheEntries?: number;
}
