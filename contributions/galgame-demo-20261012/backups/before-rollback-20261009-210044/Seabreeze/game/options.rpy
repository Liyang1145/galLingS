define config.name = "海风与布丁"
define config.version = "0.1.2"
define config.save_directory = "SeabreezePudding-0.1-player"
define config.window_title = "海风与布丁 · 第一话体验版"
define config.has_sound = True
define config.has_music = True
define config.has_voice = False
define config.default_text_cps = 35
define config.default_afm_time = 12
define config.rollback_enabled = True
define config.history_length = 250
define config.check_conflicting_properties = True
define config.game_menu_action = ShowMenu("save")
define build.name = "SeabreezePudding"
define build.directory_name = "SeabreezePudding-0.1.2"
init python:
    build.classify('**~', None)
    build.classify('**.bak', None)
    build.classify('**.log', None)
    build.classify('log.txt', None)
    build.classify('traceback.txt', None)
    build.classify('errors.txt', None)
    build.classify('game/saves/**', None)
    build.classify('game/cache/**', None)
    build.classify('game/tests.rpy', None)
    build.classify('game/tests.rpyc', None)
    build.classify('tests/**', None)
    build.classify('game/**.rpy', 'all')
    build.classify('game/**.rpyc', 'all')
