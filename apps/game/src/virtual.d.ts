declare module "virtual:haifeng-content" {
  const content: import("../../../packages/story-model/src/model.ts").StoryContent;
  export const locations: Readonly<Record<string, string>>;
  export default content;
}
