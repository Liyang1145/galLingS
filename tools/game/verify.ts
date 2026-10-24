import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { verifyGamePackageInput } from "./package-input.ts";

/** Explicit read-only CLI. Importing it never verifies, builds, prepares or starts anything. */
async function verify(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("用法：npm run game:verify -- <game:build 输出的完整产物摘要>");
  const result = await verifyGamePackageInput(args[0]!);
  const { input } = result;
  console.log(`本次完整包读取符合清单：${input.packageId}`);
  console.log(`作品：${input.manifest.workId}；内容修订：${input.manifest.contentRevision}`);
  console.log(`登记物理文件（含清单）：${result.files} 个，共 ${result.bytes} 字节；剧情节点 ${input.content.nodes.length} 个，资源 ID ${input.manifest.resources.length} 个。`);
  console.log("未构建、准备、启动、解码媒体或写入文件；这不是路线、授权、签名或平台验收，也不是后续复制可跳过校验的凭证。");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verify().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "游戏包读取核验失败");
    process.exitCode = 1;
  });
}
