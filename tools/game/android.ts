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
  const recordsSource = await readFile(resolve(repository, "packages/player/src/web/native-records-bootstrap.js"), "utf8");
  for (const marker of ["__HAIFENG_RECORD_PLATFORM__", "__HAIFENG_FILE_RECORDS__", "__HAIFENG_RECORD_WORK__"]) {
    if (recordsSource.split(marker).length !== 2) throw new Error(`共享记录桥的装配标记无效：${marker}`);
  }
  // Mode and work identity are bound by the Activity at launch; no machine paths enter this asset.
  const recordsBridge = recordsSource.replace("__HAIFENG_RECORD_PLATFORM__", "android-trial");
  const { output, manifest, manifestBytes } = await prepareInput(packageId, "android");
  try {
    await writeFile(resolve(output, "assets/host-bootstrap.js"), bridge, { flag: "wx" });
    await writeFile(resolve(output, "assets/native-records-bootstrap.js"), recordsBridge, { flag: "wx" });
    const receipt = {
      format: "haifeng.android-preparation/3", purpose: "integration-trial", hostBridge: manifest.hostBridge,
      packageId, workId: manifest.workId, contentRevision: manifest.contentRevision,
      manifestSha256: sha256(manifestBytes), bridgeSha256: sha256(bridge), recordsBridgeSha256: sha256(recordsBridge),
      storage: "separate-application/development-records",
    };
    await writeFile(resolve(output, "preparation.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(`Android 集成输入已准备：${output}`);
    console.log("没有运行 Gradle、生成 APK 或连接设备。后续统一测试时，在 mobile/android 执行：");
    console.log(`gradle :rebuild:assembleDebug -PrebuildPackage=${packageId}`);
    console.log("普通启动仍使用 IndexedDB；文件记录试用须在启动 Activity 时显式传入布尔 extra rebuild-file-records=true，不迁移已有浏览器记录。");
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
