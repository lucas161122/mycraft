import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outputPath = join(root, "Craft Game.html");

const [css, threeModule, mainJs] = await Promise.all([
  readFile(join(root, "src/styles.css"), "utf8"),
  readFile(join(root, "src/vendor/three.module.js"), "utf8"),
  readFile(join(root, "src/main.js"), "utf8")
]);

const exportMatch = threeModule.match(/export\s+\{([\s\S]*?)\};\s*$/);
if (!exportMatch) {
  throw new Error("Could not find Three.js export list.");
}

const threeExports = exportMatch[1]
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean)
  .map((entry) => {
    const aliasMatch = entry.match(/^(.+?)\s+as\s+(.+)$/);
    return aliasMatch ? `${aliasMatch[2]}: ${aliasMatch[1]}` : entry;
  });

const bundledMain = mainJs.replace('import * as THREE from "./vendor/three.module.js";\n\n', "");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>像素世界</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <main id="app">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="stats">
          <span id="block-label">草方块</span>
          <span id="position-label">0, 0, 0</span>
        </div>
        <div class="escape-note">要退出游戏，请按两次ESC。</div>
        <div class="crosshair" aria-hidden="true"></div>
        <div id="hotbar" class="hotbar" aria-label="方块快捷栏"></div>
      </div>
      <button id="auto-jump-toggle" class="auto-jump-toggle" type="button" aria-pressed="false">
        <span>自动跳跃</span>
        <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
      </button>
      <section id="start-panel" class="start-panel">
        <div class="brand">
          <span class="brand-mark"></span>
          <span>Voxel First Day</span>
        </div>
        <h1>像素世界</h1>
        <p>探索一座程序生成的小岛，挖掉方块，放上自己设计的体素材质。</p>
        <div class="menu-actions">
          <button id="start-button" type="button">进入世界</button>
          <button id="quit-button" class="secondary hidden" type="button">2退出游戏</button>
        </div>
        <div class="controls">
          <span>WASD 移动</span>
          <span>空格跳跃</span>
          <span>左键挖掘</span>
          <span>右键放置</span>
          <span>1-8 选方块</span>
        </div>
        <span class="version-label">0.2</span>
      </section>
    </main>
    <script type="module">
${threeModule}

const THREE = Object.freeze({
  ${threeExports.join(",\n  ")}
});

${bundledMain}
    </script>
  </body>
</html>
`;

await writeFile(outputPath, html, "utf8");
console.log(outputPath);
