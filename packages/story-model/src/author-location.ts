import type { SourceLocation } from "./model.ts";
export const AUTHOR_FILE = "content/story/project.json";
export const authorLocation = (file: string, field = ""): SourceLocation => ({ file: `content/story/${file}`, field });
