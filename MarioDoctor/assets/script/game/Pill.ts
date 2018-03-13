import Virus from "./Virus";

export default class Pill {
    x: number = null;
    y: number = null;
    type: string = null;

    stock: boolean = false;

    direction: string = null;

    enableControl: boolean = false;
    mainControl: boolean = false;

    anotherPart: Pill = null;

    needDestroy: boolean = false;
    beforeDestroyRender = false;
}
