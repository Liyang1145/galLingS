# Cubism MCP 核实结果

核实日期：2026-10-11。用户要求先寻找无需 computer-use 的 Cubism MCP；本轮仅检索文档与源码，未安装、升级、启动插件或修改模型。

## 找到的直接连接项目

- CubismExternalEditMCP：https://github.com/nana7chi/CubismExternalEditMCP
- Python stdio MCP -> localhost WebSocket22033 -> Cubism Editor 官方外部接口。
- 项目 README 声明42工具：读取模型/参数、对象与变形器结构；增删参数及关键点，组织部件，创建变形器，改遮罩/绘制顺序/混合色/不透明度；批量编辑事务失败回滚。
- 完整结构查询与编辑需要5.4 Alpha；5.3的参数读写是临时参数值控制，不能等同于改变眼睑网格及保存新的关键形。

## 对当前眼睛修改的限制

核实当前 cubism_mcp.py 的 cubism_edit_artmesh、cubism_edit_warp_deformer、cubism_edit_rotation_deformer 签名：前两项没有顶点坐标或弯曲控制点写入参数；旋转变形器支持角度/基准角/统一缩放。官方 Alpha API 的 EditArtMesh 同样只列属性编辑，GetObject 的 Vertices 是顶点数量而非坐标数组。不能把“编辑ArtMesh”宣传为能直接捏眼睑形状。

因此：可以替代大量结构和参数管理点击，但尚无证据证明能独立完成眼裂、上眼睑形状、透视网格、贴图导入及最终导出。未在本机连接实测，不宣称已可用。

## 版本核实

README 的 Alpha1 截止2026-09-14已过时。官方公告说明 Alpha2 延长到2026-10-18；当前日期仍在有效期内。官方不保证Alpha数据迁移，并要求Alpha产物仅个人使用，避免销售或分发。与本任务最终 GitHub 汇总和正式游戏交付有关，不能把Alpha副本自动替换为生产源。

官方公告：https://www.live2d.com/en/information/cubism-5_4-alpha/
官方编辑API文档：https://cubism.live2d.com/editor-alpha/doc/manual/alpha1/en/external-api-intergration/index.html
现有版本外部接口：https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/

## 建议

以独立模型副本验证MCP读取与非破坏性编辑能力，保留5.3原生文件。先确认是否有可写几何扩展，若没有，采用MCP管理结构/参数加必要的Cubism图形编辑；不能承诺完全免GUI。MCP连接首次需要用户在Cubism批准Allow/Edit。

插件目录搜索 Live2D Cubism 返回空；这不代表公开仓库不存在。另一些Live2D/VTuber MCP只是播放或替代运行时，不适合作为本机Cubism建模接口。
