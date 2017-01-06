/**
 * @file 解析 CSS 模块。
 */
import {BuildFile} from "tpack/src/buildFile";
import {BuildModule, ModuleOptions, ModuleType, UrlUsage, encodeString, decodeString} from "./module";

/**
 * 表示一个 CSS 模块。
 */
export class CssModule extends BuildModule {

    /**
     * 获取当前解析模块的配置。
     */
    options: CssOptions;

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.css; }

    /**
     * 当被子类重写时，负责解析当前模块。
     */
    protected parse() {
        this.content.replace(/\/\*([\s\S]*?)(?:\*\/|$)|((?:@import\s+url|\burl)\s*\(\s*)("(?:[^\\"\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^\)\r\n]*)(\s*\)\s*;?)|(\bsrc\s*=\s*)("(?:[^\\"\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^\)\r\n\},\s]*)/g, (source: string, comment: string, urlPrefix: string, urlArg: string, urlPostfix: string, srcPrefix: string, srcArg: string, sourceIndex: number) => {

            // /* ... */
            if (comment) {
                this.parseComment(source, sourceIndex, comment, sourceIndex + 2);
                return "";
            }

            // @import url(...);, url(...)
            if (urlPrefix) {

                // @import url(...);
                if (urlPrefix.charCodeAt(0) === 64/*@*/) {
                    this.parseImport(source, sourceIndex, urlPrefix, urlArg, urlPostfix);
                    return "";
                }

                // url(...)
                this.parseUrl(urlArg, sourceIndex + urlPrefix.length, decodeString(urlArg), "url", url => encodeString(url, urlArg));
                return "";
            }

            // NOTE: IE 6-8 filter 属性，需要继续支持?
            // src=...
            if (srcPrefix && (!this.options.css || this.options.css.src !== false)) {
                this.parseUrl(srcArg, sourceIndex + srcPrefix.length, decodeString(srcArg), "src", url => srcPrefix + encodeString(url, srcArg));
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
    protected parseImport(source: string, sourceIndex: number, urlPrefix: string, url: string, urlPostfix: string) {

        // 获取配置。
        let options = this.options.css && this.options.css.import;
        if (typeof options === "function") options = (options as (url: string, file: BuildFile) => "inline" | "none" | "url" | boolean)(decodeString(url), this.file);

        switch (options) {

            // 禁止解析 @import。
            case false:
            case "none":
                break;

            // 以地址方式解析。
            case "url":
                this.parseUrl(url, sourceIndex + urlPrefix.length, decodeString(url), "@import", url => urlPrefix + encodeString(url, url) + urlPostfix);
                break;

            // 内联。
            default:
                // NOTE: 内联时不支持地址 __inline 标记。
                let obj = this.resolveUrl(url, sourceIndex + urlPrefix.length, decodeString(url), UrlUsage.inline);
                if (obj) {
                    this.require(url, sourceIndex + urlPrefix.length, obj.module, "@import");
                    this.replace(sourceIndex, sourceIndex + source.length, "");
                }
                break;

        }

    }

}

/**
 * 表示解析 CSS 模块的配置。
 */
export interface CssOptions extends ModuleOptions {

    /**
     * 解析 CSS 的配置。
     */
    css?: {

        /**
         * 处理 @import 的方式。
         * - true/"inline": 内联 @import。
         * - "url": 更新引用地址。
         * - false/"none": 不处理。
         * - 函数：返回特定地址的处理方式。
         * @default "inline"
         */
        import?: "inline" | "none" | "url" | boolean | ((url: string, file: BuildFile) => "inline" | "none" | "url" | boolean);

        /**
         * 是否解析 src=...。
         */
        src?: boolean;

    }

}
