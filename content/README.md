# content/

TypeScript 重构的独立游戏界面资源见 [game-ui](game-ui/README.md)，只含原图形定义及迁移来源；唯一剧情作者源仍为 `海风与布丁/game.js`。下方为保留的原 Demo 内容说明，不作为当前重构命令或授权依据。

剧本、角色卡、素材。**仓库是公开的，正式剧本与角色卡继续不进 git；用户明确授权上传的素材收录在 [素材库](assets/README.md)，权利说明见该目录。**

运行 Demo 需要：

```
content/
├── cards/whale.yaml              鲸鱼小姐角色卡
└── scripts/
    ├── appendix_e.md             附录 E（制作 ID 登记表）
    └── ch01/
        ├── ch01.md               第一话剧本（全卷第 49–404 行）
        └── beats.yaml            节拍层元数据（选项性质、节拍目的、槽位）
```

`chapter.json` 和 `report.md` 由编译器生成（`python -m compiler content/scripts/ch01 --appendix content/scripts/appendix_e.md`，服务启动时也会自动重编译）。
测试用的原创迷你章节在 `tests/fixtures/`，CI 只用它。
