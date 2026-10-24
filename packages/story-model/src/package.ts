import type { SourceLocation, StoryContent } from "./model.ts";
import { array, at, knownFields, object, reject, string } from "./read.ts";
import { hash, localPath, nonempty, nonnegative, oneOf } from "./content.ts";
import { HOST_BRIDGE_PROTOCOL } from "./host.ts";

export interface PackageFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface PackagedResource extends PackageFile {
  assetId: string;
  sourcePath: string;
}

/** Internal delivery protocol, not a game release/version or a native installer. */
export interface GamePackage {
  format: "haifeng.game-package/2";
  hostBridge: typeof HOST_BRIDGE_PROTOCOL;
  target: "shared-web";
  purpose: "game";
  workId: string;
  contentRevision: string;
  entry: "index.html";
  build: { commit: string; dirty: boolean; lockSha256: string; vite: string };
  story: PackageFile;
  provenance: PackageFile;
  frontend: PackageFile[];
  resources: PackagedResource[];
}

const ROOT: SourceLocation = { file: "game-package.json", field: "" };

export function packagePath(input: unknown, source: SourceLocation): string {
  const path = localPath(input, source);
  // Package filenames are literal, encoded exactly once by the URL adapter.
  if (path.includes("%")) reject("PACKAGE_PATH", "包内位置不能预先进行 URL 编码", source);
  return path;
}

export function readGamePackage(input: unknown): GamePackage {
  const data = object(input, ROOT);
  knownFields(data, ["format", "hostBridge", "target", "purpose", "workId", "contentRevision", "entry", "build", "story", "provenance", "frontend", "resources"], ROOT);
  if (data.format !== "haifeng.game-package/2") reject("PACKAGE_FORMAT", "游戏包格式不受当前宿主支持，请重新构建并准备", ROOT);
  const buildSource = at(ROOT, "build");
  const build = object(data.build, buildSource);
  knownFields(build, ["commit", "dirty", "lockSha256", "vite"], buildSource);
  const commit = string(build.commit, at(buildSource, "commit"));
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit)) reject("PACKAGE_BUILD", "构建提交标识无效", buildSource);
  if (typeof build.dirty !== "boolean") reject("PACKAGE_BUILD", "需要明确的工作区状态", buildSource);
  const files = new Map<string, PackageFile>();
  function file(input: unknown, source: SourceLocation, resource = false): PackageFile {
    const item = object(input, source);
    knownFields(item, resource ? ["path", "sha256", "bytes", "assetId", "sourcePath"] : ["path", "sha256", "bytes"], source);
    const path = packagePath(item.path, at(source, "path"));
    const sha256 = hash(item.sha256, at(source, "sha256"));
    const bytes = nonnegative(item.bytes, at(source, "bytes"));
    if (!Number.isSafeInteger(bytes)) reject("PACKAGE_BYTES", "文件大小必须是安全整数", source);
    const key = path.toLowerCase();
    if (key === "game-package.json") reject("PACKAGE_PATH", "文件不能占用清单位置", source);
    const previous = files.get(key);
    if (previous && (!resource || previous.path !== path || previous.sha256 !== sha256 || previous.bytes !== bytes)) {
      reject("PACKAGE_COLLISION", "包内文件位置重复或大小写冲突", source);
    }
    const result = { path, sha256, bytes };
    files.set(key, result);
    return result;
  }
  const story = file(data.story, at(ROOT, "story"));
  const provenance = file(data.provenance, at(ROOT, "provenance"));
  if (!story.path.startsWith("content/") || !provenance.path.startsWith("content/") || story.path === provenance.path) {
    reject("PACKAGE_PATH", "剧情及来源文件必须分别位于 content 目录", ROOT);
  }
  const frontend = array(data.frontend, at(ROOT, "frontend")).map((input, index) => {
    const result = file(input, at(ROOT, `frontend.${index}`));
    if (result.path !== "index.html" && !result.path.startsWith("assets/")) {
      reject("PACKAGE_PATH", "前端文件必须是 index.html 或位于 assets 目录", ROOT);
    }
    return result;
  });
  if (!frontend.some(file => file.path === "index.html")) reject("PACKAGE_ENTRY", "清单缺少前端入口", ROOT);
  const ids = new Set<string>();
  const resources = array(data.resources, at(ROOT, "resources")).map((input, index): PackagedResource => {
    const source = at(ROOT, `resources.${index}`);
    const item = object(input, source);
    const result = file(input, source, true);
    if (!result.path.startsWith("media/")) reject("PACKAGE_PATH", "安装资源必须位于 media 目录", source);
    const assetId = nonempty(item.assetId, at(source, "assetId"));
    if (ids.has(assetId)) reject("PACKAGE_RESOURCE", "资源 ID 重复", source);
    ids.add(assetId);
    return { ...result, assetId, sourcePath: localPath(item.sourcePath, at(source, "sourcePath")) };
  });
  return {
    format: "haifeng.game-package/2",
    hostBridge: oneOf(data.hostBridge, [HOST_BRIDGE_PROTOCOL] as const, at(ROOT, "hostBridge")),
    target: oneOf(data.target, ["shared-web"] as const, at(ROOT, "target")),
    purpose: oneOf(data.purpose, ["game"] as const, at(ROOT, "purpose")),
    entry: oneOf(data.entry, ["index.html"] as const, at(ROOT, "entry")),
    workId: nonempty(data.workId, at(ROOT, "workId")), contentRevision: hash(data.contentRevision, at(ROOT, "contentRevision")),
    build: {
      commit, dirty: build.dirty, lockSha256: hash(build.lockSha256, at(buildSource, "lockSha256")),
      vite: nonempty(build.vite, at(buildSource, "vite")),
    },
    story, provenance, frontend, resources,
  };
}

export function assertPackageContent(manifest: GamePackage, content: StoryContent): void {
  if (manifest.workId !== content.workId || manifest.contentRevision !== content.revision) {
    reject("PACKAGE_CONTENT", "清单与剧情的作品或内容修订不一致", ROOT);
  }
  const resources = new Map(manifest.resources.map(resource => [resource.assetId, resource]));
  if (resources.size !== content.resources.length) reject("PACKAGE_RESOURCE", "清单未完整覆盖剧情登记资源", ROOT);
  for (const resource of content.resources) {
    if (resources.get(resource.id)?.sourcePath !== resource.path) {
      reject("PACKAGE_RESOURCE", `资源「${resource.id}」的身份或来源路径不一致`, at(ROOT, "resources"));
    }
  }
}
