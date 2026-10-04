// 具体功能参考 https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/script/type/importmap
if (typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('importmap')) {
  const importMap = {
  "imports": {
    "vue": "./game/vue.esm-browser.js",
    "typescript": "./game/typescript.js",
    "@vue/devtools-api": "./game/empty-devtools-api.js",
    "@/": "./",
    "@vue/": "./node_modules/@types/noname-typings/@vue/",
    "codemirror": "./game/codemirror6.js",
    "@codemirror/autocomplete": "./game/@codemirror/autocomplete/index.js",
    "@codemirror/commands": "./game/@codemirror/commands/index.js",
    "@codemirror/lang-css": "./game/@codemirror/lang-css/index.js",
    "@codemirror/lang-html": "./game/@codemirror/lang-html/index.js",
    "@codemirror/lang-javascript": "./game/@codemirror/lang-javascript/index.js",
    "@codemirror/lang-json": "./game/@codemirror/lang-json/index.js",
    "@codemirror/lang-markdown": "./game/@codemirror/lang-markdown/index.js",
    "@codemirror/lang-vue": "./game/@codemirror/lang-vue/index.js",
    "@codemirror/language": "./game/@codemirror/language/index.js",
    "@codemirror/lint": "./game/@codemirror/lint/index.js",
    "@codemirror/search": "./game/@codemirror/search/index.js",
    "@codemirror/state": "./game/@codemirror/state/index.js",
    "@codemirror/view": "./game/@codemirror/view/index.js"
  },
  "scopes": {}
}
  if (
    typeof window.require == "function" &&
    typeof window.process == "object" &&
    typeof window.__dirname == "string"
  ) {
    // 使importMap解析node内置模块
    const builtinModules = require("module").builtinModules;
    if (Array.isArray(builtinModules)) {
      for (const module of builtinModules) {
        importMap.imports[module] = importMap.imports[`node:${module}`] =
          `./noname-builtinModules/${module}`;
      }
    }
  }
  const im = document.createElement("script");
  im.type = "importmap";
  im.textContent = JSON.stringify(importMap, null, 2);
  // @ts-ignore
  document.currentScript.after(im);
}