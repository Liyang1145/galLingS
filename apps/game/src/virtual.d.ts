declare module "virtual:haifeng-content" {
  export function loadContent(signal?: AbortSignal): Promise<{
    content: import("../../../packages/story-model/src/model.ts").StoryContent;
    locations: Readonly<Record<string, string>>;
  }>;
}
