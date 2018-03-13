import Pill from "./Pill";
import Virus from "./Virus";
import GameConfig from "./GameConfig";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Game extends cc.Component {

    pills: Pill[] = [];
    virus: Virus[] = [];
    nextPillMakeData: string[] = null;

    isPaused: boolean = true;

    frame: number = 0;
    naturalFallFrequency: number = 20; //自然掉落刷新頻率
    controlFallFrequency: number = null; //控制時掉落刷新頻率
    destroyPillAndVirusFrequency: number = 20; //摧毀連線刷新頻率
    preparePillFrequency: number = 10; //吞藥刷新頻率

    gamePhase: string = null; //遊戲階段

    gameSprites: cc.SpriteFrame[] = null;

    @property(cc.AnimationClip)
    redAni: cc.AnimationClip = null;

    @property(cc.AnimationClip)
    blueAni: cc.AnimationClip = null;

    @property(cc.AnimationClip)
    yellowAni: cc.AnimationClip = null;

    @property(cc.AudioClip)
    music: cc.AudioClip = null;

    currentMusic = null;

    combo: number = 0;//連擊數
    score: number = 0;
    perVirusScore: number = 100;
    virusCount: number = null;
    gameEnd: boolean = false;

    option_item_yes: boolean = true;

    keyDownCallback = null;

    lastControlX = null;
    lastControlY = null;

    //生命週期函數
    onLoad() {
        this.controlFallFrequency = 75 - GameConfig.fallSpeedLevel * 15;
        this.virusCount= 8 * GameConfig.virus_level;
        this.initLoadRes();
        this.initRegisterEvent();
    }

    start() {
        this.createVirus();
        if (GameConfig.music) {
            this.currentMusic = cc.audioEngine.play(this.music, true, 1);
        }
    }

    update() {
        if (this.isPaused) {
            return;
        }

        //開始遊戲
        if (this.gamePhase == null) {
            this.nextPillMakeData = this.getPillMakeData();
            this.renderGame();
            this.renderScore();
            this.renderVirusCount();
            this.gamePhase = this.checkGamePhase();
        }

        switch (this.gamePhase) {
            case "destroyPillAndVirus":
                if (this.frame >= this.destroyPillAndVirusFrequency) {
                    this.updateDestroyStatus(true);
                    this.destroyPill();
                    this.renderGame();
                    if (this.gameEnd) {
                        this.isPaused = true;
                        return;
                    }
                    this.gamePhase = this.checkGamePhase();
                    this.frame = 0;
                }
                break;
            case "preparePill":
                if (this.frame >= this.preparePillFrequency) {
                    this.updatePillStockStatus();
                    if (this.isGameOver()) {
                        this.gameOver();
                        return;
                    }
                    this.addPill();
                    //為了動畫正常實現 將下面code搬到addPill的callback裡...
                    // this.renderGame();
                    // this.gamePhase = this.checkGamePhase();
                    // this.frame = 0;
                }
                break;
            case "controlFall":
                if (this.frame >= this.controlFallFrequency) {
                    this.updatePillStockStatus();
                    this.fall();
                    this.renderGame();
                    this.gamePhase = this.checkGamePhase();
                    this.frame = 0;

                    this.combo = 0;
                    this.updateComboLog();
                }
                break;
            case "naturalFall":
                if (this.frame >= this.naturalFallFrequency) {
                    this.updatePillStockStatus();
                    this.fall();
                    this.renderGame();
                    this.gamePhase = this.checkGamePhase();
                    this.frame = 0;
                }
                break;
        }
        this.frame++;
        this.updateLog();
    }

    //初始化函數
    initLoadRes() {
        cc.loader.loadRes("pill", cc.SpriteAtlas, (err, res) => {
            this.gameSprites = res.getSpriteFrames();
            console.log("pill load finished.");
            this.isPaused = false;
        });
    }

    initRegisterEvent() {
        // console.log("game kd register");
        GameConfig.gameKeyDown = (e) => {
            this.onControlEvent(e);
            this.onGameEndControlEvent(e);
        };
        // console.log(GameConfig.gameKeyDown);
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed: GameConfig.gameKeyDown
        }, this.node);
        // cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, GameConfig.gameKeyDown);
    }

    //渲染遊戲畫面
    renderGame() {

        //渲染下一顆藥丸
        if (this.nextPillMakeData != null) {
            let sprite_top: cc.SpriteFrame = this.getPillSpriteByName(this.nextPillMakeData[0] + "_top");
            let sprite_bottom: cc.SpriteFrame = this.getPillSpriteByName(this.nextPillMakeData[1] + "_bottom");
            let node_top = this.node.getChildByName('next_pill').getChildByName('top_part');
            let node_bottom = this.node.getChildByName('next_pill').getChildByName('bottom_part');
            node_top.getComponent(cc.Sprite).spriteFrame = sprite_top;
            node_bottom.getComponent(cc.Sprite).spriteFrame = sprite_bottom;
        }

        //清空遊戲畫面 略過病毒動畫
        let nodes = this.node.getChildByName('body').children;
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].getComponent(cc.Animation).getClips()[1] != null) {
            } else {
                nodes[i].getComponent(cc.Sprite).spriteFrame = null;
            }
        }

        //渲染藥丸
        for (let i = 0; i < this.pills.length; i++) {
            let sprite = this.getPillSpriteByPill(this.pills[i]);
            let n = this.getNodeByXY(this.pills[i].x, this.pills[i].y);
            n.getComponent(cc.Sprite).spriteFrame = sprite;
        }

        //渲染病毒
        for (let i = 0; i < this.virus.length; i++) {
            if (this.virus[i].needDestroy == true) {
                let sprite = this.getPillSpriteByName(this.virus[i].type + "_bubbles");
                let n: cc.Node = this.getNodeByXY(this.virus[i].x, this.virus[i].y);
                n.getComponent(cc.Sprite).spriteFrame = sprite;
                let aniCom = n.getComponent(cc.Animation);
                aniCom.stop(this.virus[i].type + "_ani");
                aniCom.removeClip(this.getVirusAniByVirus(this.virus[i]));
            } else {
                let n: cc.Node = this.getNodeByXY(this.virus[i].x, this.virus[i].y);
                if (n.getComponent(cc.Animation).getClips()[1] == null) {
                    let aniCom: cc.Animation = n.getComponent(cc.Animation);
                    aniCom.addClip(this.getVirusAniByVirus(this.virus[i]));
                    let state = aniCom.play(this.virus[i].type + "_ani", 0);
                }
            }
        }
    }

    getNodeByXY(x: number, y: number): cc.Node {
        let name = x + "_" + y;
        return this.node.getChildByName('body').getChildByName(name);
    }

    //判斷遊戲階段
    checkGamePhase(): string {
        if (this.isAllStock()) {
            if (this.isMatchLine()) {
                return "destroyPillAndVirus";
            } else {
                return "preparePill";
            }
        } else {
            if (this.hasControlPill()) {
                return "controlFall";
            } else {
                return "naturalFall";
            }
        }
    }

    //更新 Pill 的 stock 狀態
    updatePillStockStatus() {

        //底部的藥丸必須固定
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].y == 0) {
                this.pills[i].stock = true;
                this.pills[i].enableControl = false;
                this.pills[i].mainControl = false;
            }
        }

        //自身下方為固定物件(藥丸或病毒)的藥丸必須固定
        for (let i = 0; i < this.pills.length; i++) {
            let p = this.getPillByXY(this.pills[i].x, this.pills[i].y - 1);
            let v = this.getVirusByXY(this.pills[i].x, this.pills[i].y - 1);
            if (v != null) {
                if (this.pills[i].stock == false) {
                    this.pills[i].stock = true;
                    this.pills[i].enableControl = false;
                    this.pills[i].mainControl = false;
                    //一旦有藥丸改變狀態 重跑for迴圈 直到所有藥丸都更新狀態
                    i = -1;
                }
            } else {
                if (p != null && p.stock == true) {
                    if (this.pills[i].stock == false) {
                        this.pills[i].stock = true;
                        this.pills[i].enableControl = false;
                        this.pills[i].mainControl = false;
                        //一旦有藥丸改變狀態 重跑for迴圈 直到所有藥丸都更新狀態
                        i = -1;
                    }
                }
            }
        }

        //擁有另一半並且另一半為固定的藥丸必須固定
        for (let i = 0; i < this.pills.length; i++) {
            let p = this.pills[i].anotherPart;
            if (p != null && p.stock == true) {
                this.pills[i].stock = true;
                this.pills[i].enableControl = false;
                this.pills[i].mainControl = false;
            }
        }

        //自身下方為固定物件(藥丸或病毒)的藥丸必須固定
        /*
        * 必須再執行一次這段CODE
        * 由於當連鎖發生時 下方為空的藥丸會解除固定
        * 因為"擁有另一半並且另一半為固定的藥丸必須固定"的時機
        * 比"自身下方為固定物件(藥丸或病毒)的藥丸必須固定"還要晚
        * 這時候會有穿透的BUG產生
        * 簡單來說
        * B依賴A的狀態改變 所以A必須先執行 然後B執行
        * B執行後狀態改變 又有可能影響到A的狀態改變
        * 所以必須再執行一次A
        */
        for (let i = 0; i < this.pills.length; i++) {
            let p = this.getPillByXY(this.pills[i].x, this.pills[i].y - 1);
            let v = this.getVirusByXY(this.pills[i].x, this.pills[i].y - 1);
            if (v != null) {
                if (this.pills[i].stock == false) {
                    this.pills[i].stock = true;
                    this.pills[i].enableControl = false;
                    this.pills[i].mainControl = false;
                    //一旦有藥丸改變狀態 重跑for迴圈 直到所有藥丸都更新狀態
                    i = -1;
                }
            } else {
                if (p != null && p.stock == true) {
                    if (this.pills[i].stock == false) {
                        this.pills[i].stock = true;
                        this.pills[i].enableControl = false;
                        this.pills[i].mainControl = false;
                        //一旦有藥丸改變狀態 重跑for迴圈 直到所有藥丸都更新狀態
                        i = -1;
                    }
                }
            }
        }

        //擁有另一半並且另一半為固定的藥丸必須固定
        for (let i = 0; i < this.pills.length; i++) {
            let p = this.pills[i].anotherPart;
            if (p != null && p.stock == true) {
                this.pills[i].stock = true;
                this.pills[i].enableControl = false;
                this.pills[i].mainControl = false;
            }
        }
    }

    updatePillStockStatusAfterDestroy() {
        for (let i = 0; i < this.pills.length; i++) {
            let x = this.pills[i].x;
            let y = this.pills[i].y - 1;
            if (y >= 0) {
                let p = this.getPillByXY(x, y);
                if (p == null) {
                    if (this.pills[i].stock == true) {
                        this.pills[i].stock = false;
                        i = -1;
                    }
                } else {
                    if (p.stock == false) {
                        if (this.pills[i].stock == true) {
                            this.pills[i].stock = false;
                            i = -1;
                        }
                    }
                }
            }
        }
    }

    //是否全固定
    isAllStock(): boolean {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].stock == false) {
                return false;
            }
        }
        return true;
    }

    //掉落
    fall() {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].stock == false) {
                this.pills[i].y -= 1;
            }
        }
    }

    //摧毀達成連線的藥丸或病毒
    destroyPill() {
        let step = this.getDestroyStep();
        switch (step) {
            case "beforeDestroy":
                for (let i = 0; i < this.pills.length; i++) {
                    if (this.pills[i].needDestroy == true) {
                        this.pills[i].beforeDestroyRender = true;
                    }
                }
                for (let i = 0; i < this.virus.length; i++) {
                    if (this.virus[i].needDestroy == true) {
                        this.virus[i].beforeDestroyRender = true;
                    }
                }
                break;
            case "destroy":
                let i;
                let virusCount = 0;
                while ((i = this.getNeedDestroyPillIndex()) != -1) {
                    this.pills.splice(i, 1);
                }
                while ((i = this.getNeedDestroyVirusIndex()) != -1) {
                    virusCount++;
                    this.virus.splice(i, 1);
                }
                this.updatePillStockStatusAfterDestroy();
                // this.updatePillStockStatus();
                this.addScore(virusCount * this.perVirusScore * (this.combo + 1));
                this.combo += 1;
                this.updateComboLog();
                this.renderVirusCount();
                if (this.virus.length == 0) {
                    this.gameWin();
                }
                break;
        }
    }

    getDestroyStep(): string {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].needDestroy == true) {
                if (this.pills[i].beforeDestroyRender == true) {
                    return "destroy";
                } else {
                    return "beforeDestroy";
                }
            }
        }
    }

    getNeedDestroyPillIndex(): number {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].needDestroy == true) {
                return i;
            }
        }
        return -1;
    }

    getNeedDestroyVirusIndex(): number {
        for (let i = 0; i < this.virus.length; i++) {
            if (this.virus[i].needDestroy == true) {
                return i;
            }
        }
        return -1;
    }

    //更新 或 取得 藥丸或病毒連線狀態
    updateDestroyStatus(update: boolean) {
        for (let i = 0; i < this.pills.length; i++) {
            // if (this.pills[i].needDestroy == true && update != false) {
            //     continue;
            // }
            let arrayXY = [];
            let focusX = this.pills[i].x;
            let focusY = this.pills[i].y;
            let focusType = this.pills[i].type;
            arrayXY.push({x: focusX, y: focusY});
            //找上
            let p = null;
            let v = null;
            let continueFlag = true;
            do {
                focusY += 1;
                p = this.getPillByXY(focusX, focusY);
                v = this.getVirusByXY(focusX, focusY);
                if (p == null) {
                    if (v == null) {
                        continueFlag = false;
                    } else {
                        if (v.type == focusType) {
                            arrayXY.push({x: focusX, y: focusY});
                        } else {
                            continueFlag = false;
                        }
                    }
                } else {
                    if (p.type == focusType) {
                        arrayXY.push({x: focusX, y: focusY});
                    } else {
                        continueFlag = false;
                    }
                }
            } while (continueFlag);
            //找下
            focusY = this.pills[i].y;
            p = null;
            v = null;
            continueFlag = true;
            do {
                focusY -= 1;
                p = this.getPillByXY(focusX, focusY);
                v = this.getVirusByXY(focusX, focusY);
                if (p == null) {
                    if (v == null) {
                        continueFlag = false;
                    } else {
                        if (v.type == focusType) {
                            arrayXY.push({x: focusX, y: focusY});
                        } else {
                            continueFlag = false;
                        }
                    }
                } else {
                    if (p.type == focusType) {
                        arrayXY.push({x: focusX, y: focusY});
                    } else {
                        continueFlag = false;
                    }
                }
            } while (continueFlag);

            if (arrayXY.length >= 4) {
                if (update == false) {
                    return true;
                } else {
                    for (let i = 0; i < arrayXY.length; i++) {
                        let x = arrayXY[i].x;
                        let y = arrayXY[i].y;
                        let p = this.getPillByXY(x, y);
                        if (p != null) {
                            p.needDestroy = true;
                            if (p.anotherPart != null) {
                                p.anotherPart.anotherPart = null;
                                p.anotherPart = null;
                            }
                        }
                        let v = this.getVirusByXY(x, y);
                        if (v != null) {
                            v.needDestroy = true;
                        }
                    }
                }
            }

            arrayXY.length = 0;

            //找左
            focusY = this.pills[i].y;
            arrayXY.push({x: focusX, y: focusY});
            p = null;
            v = null;
            continueFlag = true;
            do {
                focusX -= 1;
                p = this.getPillByXY(focusX, focusY);
                v = this.getVirusByXY(focusX, focusY);
                if (p == null) {
                    if (v == null) {
                        continueFlag = false;
                    } else {
                        if (v.type == focusType) {
                            arrayXY.push({x: focusX, y: focusY});
                        } else {
                            continueFlag = false;
                        }
                    }
                } else {
                    if (p.type == focusType) {
                        arrayXY.push({x: focusX, y: focusY});
                    } else {
                        continueFlag = false;
                    }
                }
            } while (continueFlag);

            //找右
            focusX = this.pills[i].x;
            p = null;
            v = null;
            continueFlag = true;
            do {
                focusX += 1;
                p = this.getPillByXY(focusX, focusY);
                v = this.getVirusByXY(focusX, focusY);
                if (p == null) {
                    if (v == null) {
                        continueFlag = false;
                    } else {
                        if (v.type == focusType) {
                            arrayXY.push({x: focusX, y: focusY});
                        } else {
                            continueFlag = false;
                        }
                    }
                } else {
                    if (p.type == focusType) {
                        arrayXY.push({x: focusX, y: focusY});
                    } else {
                        continueFlag = false;
                    }
                }
            } while (continueFlag);

            if (arrayXY.length >= 4) {
                if (update == false) {
                    return true;
                } else {
                    for (let i = 0; i < arrayXY.length; i++) {
                        let x = arrayXY[i].x;
                        let y = arrayXY[i].y;
                        let p = this.getPillByXY(x, y);
                        if (p != null) {
                            p.needDestroy = true;
                            if (p.anotherPart != null) {
                                p.anotherPart.anotherPart = null;
                                p.anotherPart = null;
                            }
                        }
                        let v = this.getVirusByXY(x, y);
                        if (v != null) {
                            v.needDestroy = true;
                        }
                    }
                }
            }
        }
        if (update == false) {
            return false;
        }
    }

    isMatchLine(): boolean {
        return this.updateDestroyStatus(false);
    }

    getPillByXY(x: number, y: number): Pill {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].x == x && this.pills[i].y == y)
                return this.pills[i];
        }
        return null;
    }

    getVirusByXY(x: number, y: number): Virus {
        for (let i = 0; i < this.virus.length; i++) {
            if (this.virus[i].x == x && this.virus[i].y == y)
                return this.virus[i];
        }
        return null;
    }

    isGameOver(): boolean {
        let isGameOver: boolean = false;
        let x4y15 = this.getPillByXY(4, 15);
        let x4y14 = this.getPillByXY(4, 14);
        if (x4y15 != null && x4y15.stock == true || x4y14 != null && x4y14.stock == true) {
            isGameOver = true;
        }
        return isGameOver;
    }

    gameOver() {
        this.gamePhase = "GAME OVER";
        this.updateLog();
        this.isPaused = true;
        this.setGameEnd(true);
    }

    setGameEnd(end: boolean) {
        this.gameEnd = end;
        if (end) {
            if (this.currentMusic != null) {
                cc.audioEngine.stop(this.currentMusic);
                this.currentMusic = null;
            }
            this.showGameEndPanel();
        }
    }

    updateLog() {
        this.node.getChildByName('log').getComponent(cc.Label).string = this.gamePhase;
    }

    updateComboLog() {
        this.node.getChildByName('combo_log').getComponent(cc.Label).string = this.combo + "";
    }

    getPillSpriteByPill(p: Pill): cc.SpriteFrame {
        let name = p.type + "_";
        if (p.needDestroy == true) {
            name += "bubbles";
        } else if (p.anotherPart == null) {
            name += "circle";
        } else {
            name += p.direction;
        }
        for (let i = 0; i < this.gameSprites.length; i++) {
            if (this.gameSprites[i].name == name)
                return this.gameSprites[i];
        }
        return null;
    }

    getPillSpriteByName(name: string): cc.SpriteFrame {
        for (let i = 0; i < this.gameSprites.length; i++) {
            if (this.gameSprites[i].name == name)
                return this.gameSprites[i];
        }
        return null;
    }

    getVirusAniByVirus(v: Virus): cc.AnimationClip {
        switch (v.type) {
            case "red":
                return this.redAni;
            case "yellow":
                return this.yellowAni;
            case "blue":
                return this.blueAni;
        }
    }

    addPill() {

        //播放動畫
        this.isPaused = true;
        let nextPillNode: cc.Node = this.node.getChildByName("next_pill");
        let originX: number = nextPillNode.x;
        let originY: number = nextPillNode.y;
        let rotateAction = cc.rotateBy(0.4, 360 * 2, 360 * 2);
        let leftAction = cc.moveTo(0.4, cc.v2(57.7, originY));
        let downAction = cc.moveTo(0.4, cc.v2(57.7, 169.8));
        let callback = cc.callFunc(() => {
            //新增藥丸
            let pill: Pill = new Pill();
            let pill2: Pill = new Pill();

            pill.x = 4;
            pill.y = 15;
            pill.type = this.nextPillMakeData[0];
            pill.direction = "top";
            pill.enableControl = true;
            pill.mainControl = true;
            pill.anotherPart = pill2;

            pill2.x = 4;
            pill2.y = 14;
            pill2.type = this.nextPillMakeData[1];
            pill2.direction = "bottom";
            pill2.enableControl = true;
            pill2.anotherPart = pill;

            this.pills.push(pill);
            this.pills.push(pill2);

            this.nextPillMakeData = this.getPillMakeData();

            this.isPaused = false;
            this.renderGame();
            this.gamePhase = this.checkGamePhase();
            this.frame = 0;
        });
        nextPillNode.runAction(cc.sequence(cc.spawn(leftAction, rotateAction), downAction, callback, cc.callFunc(() => {
            nextPillNode.x = originX;
            nextPillNode.y = originY;
        })));
    }

    getPillMakeData(): string[] {
        let getType = (): string => {
            return ["red", "yellow", "blue"][Math.floor(Math.random() * 3)];
        };
        return [getType(), getType()];
    }

    hasControlPill(): boolean {
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].mainControl == true) {
                return true;
            }
        }
        return false;
    }

    //鍵盤事件
    onControlEvent(e) {
        //原本為 e.keyCode == 32 , systemEvent遇到轉場景失效bug 改為舊寫法
        switch (e) {
            case 65:
            case 37:
                this.onMoveLeftEvent();
                break;
            case 32:
                this.onChangeDirectionEvent();
                break;
            case 68:
            case 39:
                this.onMoveRightEvent();
                break;
            case 83:
                this.onMoveDownEvent();
                break;
        }
    }

    onMoveRightEvent() {
        let cPills = this.getControlPills();
        if (cPills != null) {
            let mainPill: Pill = cPills[0].mainControl ? cPills[0] : cPills[1];
            let nonMainPill: Pill = cPills[0].mainControl ? cPills[1] : cPills[0];
            let direction: string = mainPill.direction;
            let mx = mainPill.x;
            let my = mainPill.y;
            let nmx = nonMainPill.x;
            let nmy = nonMainPill.y;
            switch (direction) {
                case "top":
                    mx += 1;
                    nmx += 1;
                    break;
                case "bottom":
                    mx += 1;
                    nmx += 1;
                    break;
                case "right":
                    mx += 1;
                    break;
                case "left":
                    nmx += 1;
                    break;
            }
            let enableMove = true;
            if (direction == "top" || direction == "bottom") {
                if (mx >= 8 || mx < 0 || nmx >= 8 || nmx < 0) {
                    enableMove = false;
                } else {
                    let mp = this.getPillByXY(mx, my);
                    if (mp != null) {
                        enableMove = false;
                    }
                    let nmp = this.getPillByXY(nmx, nmy);
                    if (nmp != null) {
                        enableMove = false;
                    }
                    let mv = this.getVirusByXY(mx, my);
                    if (mv != null) {
                        enableMove = false;
                    }
                    let nmv = this.getVirusByXY(nmx, nmy);
                    if (nmv != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    mainPill.x = mx;
                    mainPill.y = my;
                    nonMainPill.x = nmx;
                    nonMainPill.y = nmy;
                    this.renderGame();
                }
            } else if (direction == "right") {
                if (mx >= 8) {
                    enableMove = false;
                } else {
                    let p = this.getPillByXY(mx, my);
                    if (p != null) {
                        enableMove = false;
                    }
                    let v = this.getVirusByXY(mx, my);
                    if (v != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    nonMainPill.x = mainPill.x;
                    nonMainPill.y = mainPill.y;
                    mainPill.x = mx;
                    mainPill.y = my;
                    this.renderGame();
                }
            } else if (direction == "left") {
                if (nmx >= 8) {
                    enableMove = false;
                } else {
                    let p = this.getPillByXY(nmx, nmy);
                    if (p != null) {
                        enableMove = false;
                    }
                    let v = this.getVirusByXY(nmx, nmy);
                    if (v != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    mainPill.x = nonMainPill.x;
                    mainPill.y = nonMainPill.y;
                    nonMainPill.x = nmx;
                    nonMainPill.y = nmy;
                    this.renderGame();
                }
            }
        }
    }

    onMoveLeftEvent() {
        let cPills = this.getControlPills();
        if (cPills != null) {
            let mainPill: Pill = cPills[0].mainControl ? cPills[0] : cPills[1];
            let nonMainPill: Pill = cPills[0].mainControl ? cPills[1] : cPills[0];
            let direction: string = mainPill.direction;
            let mx = mainPill.x;
            let my = mainPill.y;
            let nmx = nonMainPill.x;
            let nmy = nonMainPill.y;
            switch (direction) {
                case "top":
                    mx -= 1;
                    nmx -= 1;
                    break;
                case "bottom":
                    mx -= 1;
                    nmx -= 1;
                    break;
                case "right":
                    nmx -= 1;
                    break;
                case "left":
                    mx -= 1;
                    break;
            }
            let enableMove = true;
            if (direction == "top" || direction == "bottom") {
                if (mx >= 8 || mx < 0 || nmx >= 8 || nmx < 0) {
                    enableMove = false;
                } else {
                    let mp = this.getPillByXY(mx, my);
                    if (mp != null) {
                        enableMove = false;
                    }
                    let nmp = this.getPillByXY(nmx, nmy);
                    if (nmp != null) {
                        enableMove = false;
                    }
                    let mv = this.getVirusByXY(mx, my);
                    if (mv != null) {
                        enableMove = false;
                    }
                    let nmv = this.getVirusByXY(nmx, nmy);
                    if (nmv != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    mainPill.x = mx;
                    mainPill.y = my;
                    nonMainPill.x = nmx;
                    nonMainPill.y = nmy;
                    this.renderGame();
                }
            } else if (direction == "right") {
                if (nmx < 0) {
                    enableMove = false;
                } else {
                    let p = this.getPillByXY(nmx, nmy);
                    if (p != null) {
                        enableMove = false;
                    }
                    let v = this.getVirusByXY(nmx, nmy);
                    if (v != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    mainPill.x = nonMainPill.x;
                    mainPill.y = nonMainPill.y;
                    nonMainPill.x = nmx;
                    nonMainPill.y = nmy;
                    this.renderGame();
                }
            } else if (direction == "left") {
                if (mx < 0) {
                    enableMove = false;
                } else {
                    let p = this.getPillByXY(mx, my);
                    if (p != null) {
                        enableMove = false;
                    }
                    let v = this.getVirusByXY(mx, my);
                    if (v != null) {
                        enableMove = false;
                    }
                }
                if (enableMove == true) {
                    nonMainPill.x = mainPill.x;
                    nonMainPill.y = mainPill.y;
                    mainPill.x = mx;
                    mainPill.y = my;
                    this.renderGame();
                }
            }
        }
    }

    onChangeDirectionEvent() {
        let cPills = this.getControlPills();
        if (cPills != null) {
            let nonMainPill: Pill = cPills[0].mainControl ? cPills[1] : cPills[0];
            let mainPill: Pill = nonMainPill.anotherPart;
            let direction: string = nonMainPill.direction;
            let moveDirection = null;
            switch (direction) {
                case "top":
                    moveDirection = ["right", "bottom", "left"];
                    break;
                case "right":
                    moveDirection = ["bottom", "left", "top"];
                    break;
                case "left":
                    moveDirection = ["top", "right", "bottom"];
                    break;
                case "bottom":
                    moveDirection = ["left", "top", "bottom"];
                    break;
                default:
                    console.error("unknown direction for change!!");
                    break;
            }
            let d = null;
            do {
                d = moveDirection.shift();
                let x = mainPill.x;
                let y = mainPill.y;
                switch (d) {
                    case "top":
                        y += 1;
                        break;
                    case "right":
                        x += 1;
                        break;
                    case "left":
                        x -= 1;
                        break;
                    case "bottom":
                        y -= 1;
                        break;
                }
                let enableChange = true;
                if (!(x < 0 || x >= 8 || y < 0 || y >= 16)) {
                    let p = this.getPillByXY(x, y);
                    if (p != null) {
                        enableChange = false;
                    }
                    let v = this.getVirusByXY(x, y);
                    if (v != null) {
                        enableChange = false;
                    }
                } else {
                    enableChange = false;
                }
                if (enableChange == true) {
                    nonMainPill.x = x;
                    nonMainPill.y = y;
                    nonMainPill.direction = d;
                    switch (d) {
                        case "top":
                            mainPill.direction = "bottom";
                            break;
                        case "right":
                            mainPill.direction = "left";
                            break;
                        case "bottom":
                            mainPill.direction = "top";
                            break;
                        case "left":
                            mainPill.direction = "right";
                            break;
                    }
                    this.renderGame();
                    break;
                }
            } while (d != null);
        }
    }

    onMoveDownEvent() {
        let cPills = this.getControlPills();
        if (cPills != null) {
            this.frame = this.controlFallFrequency;
        }
    }

    getControlPills(): Pill[] {
        let ps = [];
        for (let i = 0; i < this.pills.length; i++) {
            if (this.pills[i].enableControl == true) {
                ps.push(this.pills[i]);
            }
        }
        if (ps.length == 2) {
            return ps;
        } else if (ps.length == 0) {
            return null;
        } else {
            console.error("enableControl pill amount error!!");
        }
    }

    addScore(score: number) {
        this.score += score;
        this.renderScore();
    }

    renderScore() {
        let zeroCount = 6 - ((this.score + "").length);
        let format0 = "";
        for (let i = 0; i < zeroCount; i++) {
            format0 += "0";
        }
        this.node.getChildByName("panel").getChildByName('score_div').getChildByName('content').getComponent(cc.Label).string = format0 + this.score;
    }

    renderVirusCount() {
        let zeroCount = 2 - ((this.virus.length + "").length);
        let format0 = "";
        for (let i = 0; i < zeroCount; i++) {
            format0 += "0";
        }
        this.node.getChildByName("panel").getChildByName('virus_count_div').getChildByName('content').getComponent(cc.Label).string = format0 + this.virus.length;
    }

    createVirus() {
        let virusPosition = ((count: number) => {
            let allPositions = (() => {
                let allPos = [];
                //只允許一半以下的高度出現病毒
                for (let x = 0; x <= 7; x++) {
                    for (let y = 0; y <= 7; y++) {
                        allPos.push({x: x, y: y});
                    }
                }
                return allPos;
            })();
            let vps = [];
            for (let i = 0; i < count; i++) {
                vps.push(allPositions.splice(Math.floor(Math.random() * allPositions.length), 1)[0]);
            }
            return vps;
        })(this.virusCount);

        for (let i = 0; i < virusPosition.length; i++) {
            let virus: Virus = new Virus();
            virus.x = virusPosition[i].x;
            virus.y = virusPosition[i].y;
            virus.type = ["red", "blue", "yellow"][Math.floor(Math.random() * 3)];
            this.virus.push(virus);
        }
    }

    gameWin() {
        this.gamePhase = "WIN";
        this.updateLog();
        this.setGameEnd(true);
    }

    showGameEndPanel() {
        let panel: cc.Node = this.node.getChildByName("game_end_div");
        panel.active = true;
        panel.getChildByName("message").getComponent(cc.Label).string = this.gamePhase;
        this.renderOptionItem();
    }

    renderOptionItem() {
        let panel: cc.Node = this.node.getChildByName("game_end_div");
        let yes = panel.getChildByName("yes");
        let no = panel.getChildByName("no");
        if (this.option_item_yes) {
            yes.color = cc.Color.RED;
            no.color = cc.Color.BLACK;
        } else {
            yes.color = cc.Color.BLACK;
            no.color = cc.Color.RED;
        }
    }

    onGameEndControlEvent(e) {
        //原本為 e.keyCode == 32 , systemEvent遇到轉場景失效bug 改為舊寫法
        if (this.gameEnd) {
            switch (e) {
                case 65:
                case 37:
                case 68:
                case 39:
                    this.option_item_yes = !this.option_item_yes;
                    this.renderOptionItem();
                    break;
                case 32:
                    if (!this.option_item_yes) {
                        cc.eventManager.removeListener(GameConfig.gameKeyDown);
                        // cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN,GameConfig.gameKeyDown);
                        cc.director.loadScene("load");
                    } else {
                        cc.eventManager.removeListener(GameConfig.gameKeyDown);
                        cc.director.loadScene("menu");
                    }
                    break;
            }
        }
    }
}
