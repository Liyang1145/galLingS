testsuite global:
    setup:
        $ _test.timeout = 60
        $ preferences.skip_unseen = True
    teardown:
        exit

testsuite chapter:
    before testcase:
        run Start()

    testcase all_routes:
        parameter a = [0, 1, 2]
        parameter b = [0, 1, 2]
        parameter c = [0, 1, 2]
        parameter d = [0, 1, 2]
        skip until screen "choice"
        click expression ["我可以解释——", "对不起！", "……手感不错。"][a]
        skip until screen "choice"
        click expression ["你的尾巴重要。", "本子重要。", "都重要。"][b]
        skip until screen "choice"
        click expression ["记一个问题的答案。", "记你。", "商业机密。"][c]
        skip until screen "choice"
        click expression ["手艺真好。是你做的吗？", "谢谢，很好吃。", "（默默吃掉）"][d]
        skip until screen "chapter_end"
        assert eval affection == [0,0,-5][a] + [10,-10,3][b] + [0,5,-2][c] + [5,3,0][d]
        assert eval len(choices_taken) == 4
        assert eval looking_away == (c == 1)
        assert eval persistent.chapter_one_complete
        click "回到标题"
        assert screen "main_menu"

testsuite smoke:
    testcase menus:
        pause until screen "main_menu"
        assert screen "main_menu"
        $ renpy.screenshot("qa-title.png")
        click "设置"
        assert screen "preferences"
        $ renpy.screenshot("qa-settings.png")
        click "返回"
        click "走向浅滩"
        skip until screen "choice"
        $ renpy.screenshot("qa-choice.png")
        run ShowMenu("save")
        assert screen "save"
        $ renpy.screenshot("qa-save.png")
        click "返回"
        click "……手感不错。"
        skip until screen "choice"
        assert eval affection == -5
        $ persistent._qa_loaded = False
        $ renpy.save("qa-slot")
        if eval not persistent._qa_loaded:
            click "你的尾巴重要。"
            skip until screen "choice"
            assert eval affection == 5
            $ persistent._qa_loaded = True
            $ renpy.load("qa-slot")
        assert screen "choice"
        assert eval affection == -5
        click "都重要。"
        skip until screen "choice"
        assert eval affection == -2
        run ShowMenu("history")
        assert screen "history"
        $ renpy.screenshot("qa-history.png")
        click "返回"
        run MainMenu(confirm=False)

testsuite scenery:
    testcase scene_sequence:
        run Start()
        skip until screen "choice"
        assert eval renpy.showing("bg day")
        click "对不起！"
        skip until screen "choice"
        click "都重要。"
        skip until screen "choice"
        assert eval renpy.showing("bg afternoon")
        $ renpy.screenshot("qa-afternoon.png")
        click "记你。"
        skip until screen "choice"
        click "谢谢，很好吃。"
        advance until "明天还来。"
        assert eval renpy.showing("bg golden")
        $ renpy.screenshot("qa-golden.png")
        advance until "回到帐篷的时候，门口放着一串烤小鱿鱼。"
        assert eval renpy.showing("bg camp")
        $ renpy.screenshot("qa-camp.png")
        skip until screen "chapter_end"
        assert eval len(choices_taken) == 4
        assert eval affection == 11


