import "./style.css";
import { GameController } from "./game/GameController";

const game = new GameController(document.querySelector<HTMLElement>("#app")!);
void game.initialize();

// HMR cleanup is explicit. Normal navigation lets the browser release the page.
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
