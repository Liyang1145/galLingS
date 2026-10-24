import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { prepareInput, sha256 } from "./prepare.ts";

/** Prepare an isolated snapshot/config only; never invokes Cargo, Tauri, installers or the game. */
async function prepare(): Promise<void> {
  if (process.platform !== "win32") throw new Error("本入口当前仅用于 Windows 集成试用");
  const [packageId, ...extra] = process.argv.slice(2);
  if (!packageId || !/^[a-f0-9]{64}$/u.test(packageId) || extra.length) {
    throw new Error("用法：npm run windows:prepare -- <game:build 输出的产物摘要>");
  }
  const { output, frontend, manifest, manifestBytes } = await prepareInput(packageId, "windows");
  try {
    // Config is written last: only a fully copied snapshot receives an entry for native building.
    const config = {
      $schema: "https://schema.tauri.app/config/2",
      productName: "海风与布丁重构试用",
      identifier: "com.gallings.haifeng.rebuild",
      build: {
        frontendDist: frontend,
        devUrl: null, beforeDevCommand: null, beforeBuildCommand: null, beforeBundleCommand: null,
        features: ["custom-protocol"],
      },
      app: {
        windows: [], withGlobalTauri: false,
        security: {
          capabilities: [],
          csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
        },
      },
      // Embed only the prepared frontend snapshot, without an external legacy game directory.
      bundle: { active: false, resources: [] },
    };
    const configPath = resolve(output, "tauri.rebuild.conf.json");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
    const receipt = {
      format: "haifeng.windows-preparation/2",
      hostBridge: manifest.hostBridge,
      purpose: "integration-trial",
      packageId, workId: manifest.workId, contentRevision: manifest.contentRevision,
      manifestSha256: sha256(manifestBytes),
      configSha256: sha256(`${JSON.stringify(config, null, 2)}\n`),
      storage: "separate-webview-profile/development-records",
    };
    await writeFile(resolve(output, "preparation.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(`Windows 集成输入已准备：${output}`);
    console.log("尚未编译、启动或生成安装包。保留此目录原样；手改后须重新准备，不能据此声称验收。");
    console.log("后续测试阶段可在 desktop/src-tauri 目录显式执行：");
    console.log(`cargo tauri build --no-bundle --config "${configPath}" -- --target-dir "${resolve(output, "native-target")}"`);
    console.log("默认继续使用独立 WebView 记录。文件记录试用须在运行新编译 EXE 时显式追加 --rebuild-file-records；不会迁移浏览器记录。");
  } catch (error: unknown) {
    console.error(`Windows 准备未完成，保留本次目录供定位，不自动删除或覆盖：${output}`);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepare().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "Windows 集成准备失败");
    process.exitCode = 1;
  });
}
