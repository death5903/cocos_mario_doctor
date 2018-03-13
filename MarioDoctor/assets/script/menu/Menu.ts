import GameConfig from "../game/GameConfig";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Menu extends cc.Component {

    lockOption: number = 1;

    start() {
        this.renderMenu();
        GameConfig.menuKeyDown = (keyCode) => {
            this.onKeyDownEvent(keyCode);
        };
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed: GameConfig.menuKeyDown
        }, this.node);
    }

    renderMenu() {
        let setting = this.node.getChildByName('game_setting_div');
        let virusLevel = setting.getChildByName('virus_level');
        let speed = setting.getChildByName('speed');
        let music = setting.getChildByName('music');

        //clear lock
        virusLevel.getChildByName('lock').active = false;
        speed.getChildByName('lock').active = false;
        music.getChildByName('lock').active = false;
        //render lock
        switch (this.lockOption) {
            case 1:
                virusLevel.getChildByName('lock').active = true;
                break;
            case 2:
                speed.getChildByName('lock').active = true;
                break;
            case 3:
                music.getChildByName('lock').active = true;
                break;
        }

        virusLevel.getChildByName('pointer').x = -173 + 49.428 * (GameConfig.virus_level - 1);
        speed.getChildByName('pointer').x = -180 + 180 * (GameConfig.fallSpeedLevel - 1);
        music.getChildByName('pointer').x = GameConfig.music ? -120 : 120;
    }

    onKeyDownEvent(keyCode) {
        console.log(keyCode);
        switch (keyCode) {
            //left
            case 65:
            case 37:
                this.onLeftEvent();
                break;
            //right
            case 68:
            case 39:
                this.onRightEvent();
                break;
            //down
            case 83:
                this.onDownEvent();
                break;
            //up
            case 87:
                this.onUpEvent();
                break;
            //space
            case 32:
                this.onSpaceEvent();
                break;
        }
    }

    onLeftEvent() {
        switch (this.lockOption) {
            case 1:
                if (GameConfig.virus_level > 1) {
                    GameConfig.virus_level--;
                }
                break;
            case 2:
                if (GameConfig.fallSpeedLevel > 1) {
                    GameConfig.fallSpeedLevel--;
                }
                break;
            case 3:
                GameConfig.music = !GameConfig.music;
                break
        }
        this.renderMenu();
    }

    onRightEvent() {
        switch (this.lockOption) {
            case 1:
                if (GameConfig.virus_level < 8) {
                    GameConfig.virus_level++;
                }
                break;
            case 2:
                if (GameConfig.fallSpeedLevel < 3) {
                    GameConfig.fallSpeedLevel++;
                }
                break;
            case 3:
                GameConfig.music = !GameConfig.music;
                break
        }
        this.renderMenu();
    }

    onUpEvent() {
        if (this.lockOption > 1) {
            this.lockOption--;
        }
        this.renderMenu();
    }

    onDownEvent() {
        if (this.lockOption < 3) {
            this.lockOption++;
        }
        this.renderMenu();
    }

    onSpaceEvent() {
        cc.eventManager.removeListener(GameConfig.menuKeyDown);
        cc.director.loadScene('game');
    }
}
