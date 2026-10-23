import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { createStoryRuntime } from "../../packages/story-runtime/src/index.ts";
import type { RuntimeCommand, RuntimeResult, StorySnapshot } from "../../packages/story-runtime/src/index.ts";
import { loadSourceContent } from "../content/build.ts";

async function main(): Promise<void> {
  console.log("《海风与布丁》新核心 · 终端逻辑试播");
  console.log("没有画面/音频/真实倒计时，也不读写正式存档；不是游戏体验验收。");
  console.log("正在读取作者源与本地资源，缺项会明确报错，不回落到旧播放器。");
  const { content } = await loadSourceContent();
  const { runtime } = createStoryRuntime(content, { "周目": 1, "结局数": 0 });
  let saved: StorySnapshot | null = null;
  let lastCommand: RuntimeCommand | null = null;
  const input = createInterface({ input: stdin, output: stdout });

  function show(): void {
    const view = runtime.view();
    console.log(`\n[${view.nodeId}] 步骤 ${view.step} / ${view.phase}${view.chapter ? ` / ${view.chapter}` : ""}`);
    console.log(`${view.presentation.speaker ? `${view.presentation.speaker}：` : ""}${view.presentation.text || "（演出节）"}`);
    console.log("变量：", JSON.stringify(view.variables));
    view.choices.forEach((choice, index) => console.log(`${index + 1}. ${choice.text} [${choice.id}]`));
    if (view.timeout) console.log(`限时 ${view.timeout.durationMs / 1000} 秒；这里不会自动计时，可输入 timeout。`);
    if (view.terminal) console.log("结束：", JSON.stringify(view.terminal));
  }

  function report(result: RuntimeResult): void {
    if (!result.accepted) console.log("操作被拒绝：", JSON.stringify(result.error));
    else if (result.facts.length) console.log("本次事实：", JSON.stringify(result.facts));
  }

  function send(command: RuntimeCommand, quiet = false): RuntimeResult {
    lastCommand = command;
    const result = runtime.dispatch(command);
    if (!quiet || !result.accepted) report(result);
    return result;
  }

  console.log("命令：next / choose 序号 / timeout / again / save / load / walk / view / quit");
  console.log("next 首先完成当前呈现，再次输入才继续；again 重发上一旧步骤操作。");
  console.log("walk 仅通过核心命令快进逻辑，停在下一选择/结局；save/load 仅保存一个内存逻辑快照。");
  show();
  try {
    while (true) {
      const answer = (await input.question("\n剧情> ")).trim();
      const [command, argument] = answer.split(/\s+/u);
      if (command === "quit" || command === "q") break;
      const view = runtime.view();
      if (command === "next" || command === "n" || !command) {
        send({ type: view.phase === "presenting" ? "presented" : "advance", step: view.step });
      } else if (command === "choose" || command === "c") {
        const index = Number(argument);
        const choice = Number.isSafeInteger(index) && index > 0 ? view.choices[index - 1] : undefined;
        if (choice) send({ type: "choose", choiceId: choice.id, step: view.step });
        else console.log("请输入当前显示的有效选项序号；核心只接收稳定选项 ID。");
      } else if (command === "timeout") {
        send({ type: "timeout", step: view.step });
      } else if (command === "again") {
        if (lastCommand) report(runtime.dispatch(lastCommand));
        else console.log("尚无上一操作。");
      } else if (command === "save") {
        saved = runtime.snapshot();
        console.log("逻辑快照已存内存；退出终端即丢失，不是完整游戏存档。");
      } else if (command === "load") {
        if (saved) report(runtime.restore(saved, runtime.view().player));
        else console.log("请先 save。");
      } else if (command === "walk") {
        let count = 0;
        while (count < 10000) {
          const current = runtime.view();
          if (current.phase === "choosing" || current.phase === "ended") break;
          const result = send({
            type: current.phase === "presenting" ? "presented" : "advance", step: current.step,
          }, true);
          if (!result.accepted) break;
          count++;
        }
        console.log(`已进行 ${count} 次核心操作；没有播放媒体或等待真实时间。`);
        if (count === 10000) console.log("达到单次步进上限，已停止，避免无交互循环。");
      } else if (command !== "view") {
        console.log("未知命令。可用：next / choose 序号 / timeout / again / save / load / walk / view / quit");
      }
      show();
    }
  } finally {
    input.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
  else console.error(error instanceof Error ? error.message : "逻辑试播失败");
  process.exitCode = 1;
});
