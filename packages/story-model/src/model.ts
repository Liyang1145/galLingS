export type Value = number | string | boolean;
export type ValueType = "number" | "string" | "boolean";
export type JsonValue = null | Value | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface SourceLocation {
  file: string;
  field: string;
  nodeId?: string;
  index?: number;
}

export interface Diagnostic {
  code: string;
  message: string;
  source: SourceLocation;
}

export class ContentError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(code: string, message: string, source: SourceLocation) {
    super(`${source.file}${source.nodeId ? ` [${source.nodeId}]` : ""} ${source.field}: ${message}`);
    this.name = "ContentError";
    this.diagnostic = { code, message, source };
  }
}

export type UnaryOperator = "!" | "-";
export type BinaryOperator = "+" | "-" | "*" | "/" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "&&" | "||";
export type Expression =
  | { kind: "literal"; value: Value }
  | { kind: "variable"; name: string }
  | { kind: "unary"; operator: UnaryOperator; operand: Expression }
  | { kind: "binary"; operator: BinaryOperator; left: Expression; right: Expression };

export interface Assignment {
  name: string;
  operator: "=" | "+=" | "-=";
  expression: Expression;
}

export interface VariableDefinition {
  name: string;
  type: ValueType;
  initial: Value;
}

export const PLAYER_VARIABLES = ["周目", "结局数"] as const;
export type PlayerProjection = Readonly<Record<(typeof PLAYER_VARIABLES)[number], number>>;

export interface Resource {
  id: string;
  kind: "bg" | "ch" | "bgm" | "se" | "vo";
  path: string;
  metadata: JsonObject;
}

export interface Sprite {
  id: string;
  assetId: string;
  x: number;
  y: number;
  height: number;
  flipped: boolean;
  enter: string;
  exit: string;
  look: string;
  poseSwitch: JsonValue;
}

export interface SoundEffect {
  assetId: string;
  gain: number;
  delayMs: number;
}

export interface Scene {
  background: string | null;
  sprites: Sprite[];
  mood: string;
  music:
    | { kind: "stop"; fadeMs: number }
    | { kind: "play"; assetId: string; continuity: "continue"; fadeMs: number };
  ambience: { assetId: string; gain: number }[];
}

export interface Presentation {
  speaker: string;
  text: string;
  scene: Scene;
  performance: {
    transition: string;
    screenEffect: string;
    actorActions: Record<string, string>;
    voiceId: string | null;
    sounds: SoundEffect[];
    waitMs: number;
    typeMultiplier: number;
    holdMs: number;
    // Preserved author cue, old unused audio fields and motion hint.
    // Not a license for a renderer to silently ignore unsupported effects.
    sourceHints: JsonObject;
  };
}

export interface Choice {
  id: string;
  text: string;
  condition: Expression;
  actions: Assignment[];
  target: string | null;
  source: SourceLocation;
}

export type Flow =
  | { kind: "next"; target: string | null }
  | { kind: "branch"; condition: Expression; then: string; otherwise: string | null }
  | { kind: "ending"; endingId: string }
  | {
      kind: "choice";
      choices: Choice[];
      emptyTarget: string | null;
      timeout: { durationMs: number; choiceId: string; unavailable: "error" } | null;
    };

export interface StoryNode {
  id: string;
  label: string;
  chapter: string;
  source: SourceLocation;
  enter: Assignment[];
  presentation: Presentation;
  flow: Flow;
}

/** Internal protocol version, not a game release/version promise. */
export const CONTENT_FORMAT = "haifeng.story/1" as const;

export interface StoryContent {
  format: typeof CONTENT_FORMAT;
  workId: string;
  title: string;
  revision: string;
  entryNodeId: string;
  variables: VariableDefinition[];
  nodes: StoryNode[];
  resources: Resource[];
  source: {
    file: string;
    sha256: string;
    metadata: JsonObject;
    settings: JsonObject;
  };
}
