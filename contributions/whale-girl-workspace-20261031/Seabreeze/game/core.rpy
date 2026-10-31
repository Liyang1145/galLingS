init -20 python:
    config.screen_width = 1280
    config.screen_height = 720

define whale = Character("鲸鱼小姐", color="#94e2dc")
define hero = Character("我", color="#f0d5aa")
define tail = Character("水下的动静", color="#a8d1d6", what_italic=True)
default affection = 0
default choices_taken = []
default looking_away = False
default scene_caption = "浅滩 · 正午"
default portrait_cue = "——"
default music_cue = ""
default persistent.cg001 = False
default persistent.chapter_one_complete = False

image bg day = Transform("images/scenes/cove_noon.png", xysize=(1280, 720))
image bg afternoon = Transform("images/scenes/cove_afternoon.png", xysize=(1280, 720))
image bg golden = Transform("images/scenes/cove_golden.png", xysize=(1280, 720))
image bg dusk = Transform("images/scenes/cove_dusk.png", xysize=(1280, 720))
image bg camp = Transform("images/scenes/camp_dusk.png", xysize=(1280, 720))
image bg sunset = Transform("images/scenes/cove_golden.png", xysize=(1280, 720))
define show_portrait_placeholder = False

label main_menu:
    call screen main_menu
    return

init python:
    # Composer handoff: map the manuscript cue to a bundled path here.
    # Missing production audio is intentionally silent, not downloaded at runtime.
    MUSIC = {}
    def apply_music_cue(cue):
        path = MUSIC.get(cue)
        if path and renpy.loadable(path):
            renpy.music.play(path, fadein=0.7)
        else:
            renpy.music.stop(fadeout=0.7)

style default:
    font "fonts/NotoSansSC.ttf"
    size 26
    color "#f3eee2"
    language "unicode"
style button:
    background Solid("#103844dd")
    hover_background Solid("#326572ee")
    padding (22, 12)
style button_text:
    color "#ecede2"
    hover_color "#ffffff"
    size 24
style bar:
    left_bar Solid("#82c3c0")
    right_bar Solid("#263f49")
    ysize 16
style slider:
    left_bar Solid("#82c3c0")
    right_bar Solid("#263f49")
    thumb Solid("#f0d5aa")
    thumb_offset 8
    xsize 420
    ysize 20
style vscrollbar:
    base_bar Solid("#263f49")
    thumb Solid("#82c3c0")
    xsize 12

screen say(who, what):
    window:
        id "window"
        background Solid("#092935ed")
        xfill True
        yalign 1.0
        ysize 230
        if who:
            text who id "who" xpos 80 ypos 22 size 25 color "#97d9d2"
        text what id "what" xpos 80 ypos 68 xsize 1120 size 28
    use quick_menu

screen quick_menu():
    zorder 100
    hbox:
        xalign 0.97
        yalign 0.985
        spacing 6
        textbutton "回退" action Rollback() text_size 18
        textbutton "记录" action ShowMenu("history") text_size 18
        textbutton "快进" action Skip() text_size 18
        textbutton "自动" action Preference("auto-forward", "toggle") text_size 18
        textbutton "存档" action ShowMenu("save") text_size 18
        textbutton "读档" action ShowMenu("load") text_size 18
        textbutton "设置" action ShowMenu("preferences") text_size 18

screen chapter_hud():
    text "海风与布丁  /  第一话" xpos 36 ypos 28 size 19 color "#ffffff" outlines [(2, "#102d45bb", 0, 0)]
    text scene_caption xpos 36 ypos 58 size 17 color "#ffffff" outlines [(2, "#102d45bb", 0, 0)]
    if show_portrait_placeholder and portrait_cue != "——":
        frame:
            background Solid("#123640bb")
            xpos 820
            ypos 190
            xsize 400
            padding (25, 25)
            vbox:
                spacing 16
                text "鲸鱼小姐" size 36 color "#bce6df"
                text "立绘待接入" size 17 color "#c5c8bd"
                text portrait_cue size 22
                if looking_away:
                    text "她避开你的视线。" size 21

screen choice(items):
    modal True
    vbox:
        xpos 60
        yalign 0.43
        spacing 16
        for item in items:
            textbutton item.caption action item.action xsize 700

screen main_menu():
    tag menu
    add "bg sunset"
    add Solid("#082b3555")
    vbox:
        xpos 100
        ypos 70
        spacing 10
        text "SEABREEZE & PUDDING" size 18 color "#f5ead9" outlines [(2, "#102d45bb", 0, 0)]
        text "海风与布丁" size 64 color "#fff5e3" outlines [(2, "#102d45bb", 0, 0)]
        text "第一话 · 浅滩上的偶遇" size 27 color "#f5ead9" outlines [(2, "#102d45bb", 0, 0)]
        null height 15
        textbutton "走向浅滩" action Start() xsize 300
        textbutton "拾起记忆" action ShowMenu("load") xsize 300
        textbutton "设置" action ShowMenu("preferences") xsize 300
        textbutton "制作说明" action ShowMenu("about") xsize 300
        textbutton "退出" action Quit(confirm=True) xsize 300
    text "体验版 0.1.1  ·  场景版 / 暂无配乐" xpos 100 ypos 675 size 16 color "#ffffff" outlines [(2, "#102d45bb", 0, 0)]

screen panel(title):
    add Solid("#092935f5")
    text title xpos 60 ypos 35 size 38
    textbutton "返回" action Return() xpos 1100 ypos 30
    transclude

screen save():
    tag menu
    use files("保存记忆")
screen load():
    tag menu
    use files("拾起记忆")
screen files(title):
    use panel(title):
        grid 3 2:
            xpos 60
            ypos 125
            spacing 20
            for slot in range(1,7):
                button:
                    action FileAction(slot)
                    xsize 370
                    ysize 205
                    vbox:
                        spacing 8
                        add FileScreenshot(slot) xsize 220 ysize 124
                        text FileTime(slot, format="%Y-%m-%d %H:%M", empty="空白记忆") size 18
                        text FileSaveName(slot) size 16
                    key "save_delete" action FileDelete(slot)
        hbox:
            xpos 60
            ypos 600
            spacing 14
            textbutton "自动" action FilePage("auto")
            for page in range(1,5):
                textbutton str(page) action FilePage(page)
            textbutton "主菜单" action MainMenu()

screen preferences():
    tag menu
    use panel("设置"):
        vbox:
            xpos 100
            ypos 135
            spacing 25
            hbox:
                spacing 20
                textbutton "窗口" action Preference("display", "window")
                textbutton "全屏" action Preference("display", "fullscreen")
            text "文字速度"
            bar value Preference("text speed") xsize 600
            text "自动阅读等待时间"
            bar value Preference("auto-forward time") xsize 600
            text "音乐音量（正式音乐待接入）"
            bar value Preference("music volume") xsize 600
            textbutton "跳过未读：开 / 关" action Preference("skip", "toggle")
            textbutton "返回主菜单" action MainMenu()

screen history():
    tag menu
    use panel("潮声里的记录"):
        viewport:
            xpos 80
            ypos 110
            xsize 1120
            ysize 550
            mousewheel True
            draggable True
            scrollbars "vertical"
            vbox:
                spacing 20
                for entry in _history_list:
                    if entry.who:
                        text entry.who color "#97d9d2" size 22
                    text entry.what size 24 substitute False

screen about():
    tag menu
    use panel("制作说明"):
        vbox:
            xpos 100
            ypos 145
            xsize 1080
            spacing 25
            text "改编依据：《海风与布丁》第一季全卷 v5.0。"
            text "本版包含第一话四组选项。剧情原稿保持不变；末组选项 C 暂接共同结尾。"
            text "背景为 AI 生成场景；立绘暂留空，CG、音乐由团队后续接入。"
            text "引擎：Ren’Py 8.5.3。字体：Noto Sans SC（SIL OFL 1.1）。"
            text "左键 / 空格推进，鼠标滚轮向上回退，Esc 打开菜单。"
            text "本版为本地开发体验版，尚未接入 Steam 服务。" size 22

screen chapter_end():
    modal True
    add "bg sunset"
    frame:
        background Solid("#092935ee")
        xalign 0.5
        yalign 0.5
        padding (60, 45)
        vbox:
            spacing 22
            text "第一话 · 完" size 44
            text "明天带酸梅汤。加桂花的。" size 28
            text "记忆已保存：SP-001 酸梅汤·加桂花" size 20
            textbutton "回到标题" action Return()

screen confirm(message, yes_action, no_action):
    modal True
    zorder 200
    add Solid("#000000bb")
    frame:
        background Solid("#123944")
        xalign 0.5
        yalign 0.5
        padding (40,40)
        vbox:
            spacing 24
            text message xmaximum 850
            hbox:
                spacing 30
                textbutton "确定" action yes_action
                textbutton "取消" action no_action

screen notify(message):
    zorder 100
    text message xpos 40 ypos 100 size 22
    timer 3.0 action Hide("notify")
