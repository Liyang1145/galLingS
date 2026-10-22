# WAV 的 MP3 压缩副本

完整保留素材库32份WAV的内容和声道，使用LAME VBR质量2编码；原WAV继续保存，供后续人工微调。路径沿用原音频在 `audio/` 下的目录结构。

完整索引、原件SHA、输出SHA、体积、声道、采样率和时长见 [manifest.json](manifest.json)。总素材清单中原素材ID的 `playback_variants` 指向这里。

当前游戏及单文件HTML原本使用MP3/OGG，未引用WAV。本目录为后续装配提供压缩副本，不自动替换已用的裁剪、循环或试听选择。
