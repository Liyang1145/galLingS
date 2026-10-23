import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { prepareInput, repository, sha256 } from "./prepare.ts";

/** Prepare only. Gradle, Android SDK installation, APK builds and device actions remain explicit. */
async function prepare(): Promise<void> {
  const [packageId, ...extra] = process.argv.slice(2);
  if (!packageId || !/^[a-f0-9]{64}$/u.test(packageId) || extra.length) {
    throw new Error("用法：npm run android:prepare -- <game:build 输出的产物摘要>");
  }
  const source = await readFile(resolve(repository, "packages/player/src/web/host-bootstrap.js"), "utf8");
  if (source.split("__HAIFENG_PLATFORM__").length !== 2) throw new Error("共享宿主桥的平台标记无效");
  const bridge = source.replace("__HAIFENG_PLATFORM__", "android-trial");
  const { output, manifest, manifestBytes } = await prepareInput(packageId, "android");
  try {
    await writeFile(resolve(output, "assets/host-bootstrap.js"), bridge, { flag: "wx" });
    const receipt = {
      format: "haifeng.android-preparation/1", purpose: "integration-trial",
      packageId, workId: manifest.workId, contentRevision: manifest.contentRevision,
      manifestSha256: sha256(manifestBytes), bridgeSha256: sha256(bridge),
      storage: "separate-application/development-records",
    };
    await writeFile(resolve(output, "preparation.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(`Android 集成输入已准备：${output}`);
    console.log("没有运行 Gradle、生成 APK 或连接设备。后续统一测试时，在 mobile/android 执行：");
    console.log(`gradle :rebuild:assembleDebug -PrebuildPackage=${packageId}`);
  } catch (error: unknown) {
    console.error(`Android 准备未完成，保留本次目录，不自动删除或覆盖：${output}`);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepare().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "Android 集成准备失败");
    process.exitCode = 1;
  });
}
