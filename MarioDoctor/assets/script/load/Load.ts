import GameConfig from "../game/GameConfig"

const {ccclass, property} = cc._decorator;

@ccclass
export default class Load extends cc.Component {

    complete: boolean = false;

    onLoad() {
        GameConfig.loadKeyDown = (e) => {
            this.onKeyDownEvent(e);
        };
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed: GameConfig.loadKeyDown
        }, this.node);
        // cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, GameConfig.loadKeyDown);
    }

    start() {
        cc.director.preloadScene("menu", () => {
            cc.director.preloadScene("game", () => {
                this.onLoadSceneComplete();
            });
        })
    }

    onLoadSceneComplete() {
        this.node.getChildByName("hint").active = true;
        this.node.getChildByName("start").getComponent(cc.Label).string = "- START -";
        this.node.getChildByName("start").color = cc.Color.RED;
        this.complete = true;
    }

    onKeyDownEvent(e) {
        //原本為 e.keyCode == 32 , systemEvent遇到轉場景失效bug 改為舊寫法
        if (e == 32 && this.complete) {
            cc.eventManager.removeListener(GameConfig.loadKeyDown);
            // cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN,GameConfig.loadKeyDown);
            cc.director.loadScene("menu");
        }
    }
}
