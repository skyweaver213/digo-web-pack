"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = require("./module");
/**
 * 表示一个 CSS 模块。
 */
class CssModule extends module_1.BuildModule {
    /**
     * 获取当前模块的类型。
     */
    get type() { return module_1.ModuleType.css; }
    /**
     * 当被子类重写时，负责解析当前模块。
     */
    parse() {
        this.content.replace(/\/\*([\s\S]*?)(?:\*\/|$)|((?:@import\s+url|\burl)\s*\(\s*)("(?:[^\\"\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^\)\r\n]*)(\s*\)\s*;?)|(\bsrc\s*=\s*)("(?:[^\\"\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^\)\r\n\},\s]*)/g, (source, comment, urlPrefix, urlArg, urlPostfix, srcPrefix, srcArg, sourceIndex) => {
            // /* ... */
            if (comment) {
                this.parseComment(source, sourceIndex, comment, sourceIndex + 2);
                return "";
            }
            // @import url(...);, url(...)
            if (urlPrefix) {
                // @import url(...);
                if (urlPrefix.charCodeAt(0) === 64 /*@*/) {
                    this.parseImport(source, sourceIndex, urlPrefix, urlArg, urlPostfix);
                    return "";
                }
                // url(...)
                this.parseUrl(urlArg, sourceIndex + urlPrefix.length, module_1.decodeString(urlArg), "url", url => module_1.encodeString(url, urlArg));
                return "";
            }
            // NOTE: IE 6-8 filter 属性，需要继续支持?
            // src=...
            if (srcPrefix && (!this.options.css || this.options.css.src !== false)) {
                this.parseUrl(srcArg, sourceIndex + srcPrefix.length, module_1.decodeString(srcArg), "src", url => srcPrefix + module_1.encodeString(url, srcArg));
            }
            return "";
        });
    }
    /**
     * 解析一个文件内的 `@import` 指令。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param urlPrefix 前缀部分。
     * @param url 要解析的地址参数。
     * @param urlPostfix 后缀部分。
     */
    parseImport(source, sourceIndex, urlPrefix, url, urlPostfix) {
        // 获取配置。
        let options = this.options.css && this.options.css.import;
        if (typeof options === "function")
            options = options(module_1.decodeString(url), this.file);
        switch (options) {
            // 禁止解析 @import。
            case false:
            case "none":
                break;
            // 以地址方式解析。
            case "url":
                this.parseUrl(url, sourceIndex + urlPrefix.length, module_1.decodeString(url), "@import", url => urlPrefix + module_1.encodeString(url, url) + urlPostfix);
                break;
            // 内联。
            default:
                // NOTE: 内联时不支持地址 __inline 标记。
                let obj = this.resolveUrl(url, sourceIndex + urlPrefix.length, module_1.decodeString(url), module_1.UrlUsage.inline);
                if (obj) {
                    this.require(url, sourceIndex + urlPrefix.length, obj.module, "@import");
                    this.replace(sourceIndex, sourceIndex + source.length, "");
                }
                break;
        }
    }
}
exports.CssModule = CssModule;
//# sourceMappingURL=css.js.map