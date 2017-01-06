/**
 * @file 解析 HTML 模块。
 */
import {BuildFile, Writer} from "tpack/src/buildFile";
import {BuildModule, ModuleOptions, getModule, ModuleType, ModuleTarget, UrlUsage, encodeString, decodeString} from "./module";

/**
 * 表示一个 HTML 模块。
 */
export class HtmlModule extends BuildModule {

    /**
     * 获取当前模块在模块化之前的源文件。
     */
    get source() { return this.file; }

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.html; }

    /**
     * 获取当前解析模块的配置。
     */
    options: HtmlOptions;

    /**
     * 存储已引用的模块。
     */
    private _refs: BuildModule[];

    /**
     * 标记当前模块引用了指定的模块。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param module 引用的模块。
     * @param name 引用的来源名。
     */
    ref(source: string, sourceIndex: number, module: BuildModule, name?: string) {
        super.ref(source, sourceIndex, module, name);
        this._refs = this._refs || [];
        this._refs.push(module);
    }

    /**
     * 负责解析当前模块。
     */
    protected parse() {
        this.content.replace(/<!--([\s\S]*?)(?:-->|$)|<(img|link|object|embed|audio|video|source|a|base|form|input|button)\b(?:'[^']*'|"[^"]*"|[^>])*>|(<style\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/style(?:'[^']*'|"[^"]*"|[^>])*>|$)|(<script\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/script(?:'[^']*'|"[^"]*"|[^>])*>|$)|<%([\s\S*]*?)(?:%>|$)|<\?([\s\S*]*?)(?:\?|$)>|<!([\s\S*]*?)(?:!|$)>|<#([\s\S*]*?)(?:#|$)>/ig, (source: string, comment: string, tag: string, styleStart: string, style: string, styleEnd: string, scriptStart: string, script: string, scriptEnd: string, aspTpl: string, phpTpl: string, cdata: string, sharpTpl: string, sourceIndex: number) => {

            // <!-- -->
            if (comment != null) {
                this.parseComment(source, sourceIndex, comment, sourceIndex + 4);
                return "";
            }

            // <script>
            if (scriptStart != null) {
                this.parseScript(source, sourceIndex, scriptStart, script, scriptEnd);
                return "";
            }

            // <style>
            if (styleStart != null) {
                this.parseStyle(source, sourceIndex, styleStart, style, styleEnd);
                return "";
            }

            // <img>, <link>, <object>, <embed>, <audio>, <video>, <content>, <a>, <base>, <form>, <input>
            if (tag != null) {
                this.parseTag(source, sourceIndex, tag);
                return "";
            }

            return "";
        });

    }

    /**
     * 解析一个 `<script>` 标签。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     */
    protected parseScript(source: string, sourceIndex: number, openTag: string, innerHTML: string, closeTag: string) {

        // <script src>
        let src = getAttrInfo(openTag, "src");
        if (src) {
            if (!this.canParse(openTag, sourceIndex, openTag, innerHTML, closeTag, "src")) return;
            this.parseUrl(src.source, sourceIndex + src.index, src.value, "src", url => encodeAttr(url, src.source), () => ({
                prefix: removeAttr(openTag, "src"),
                postfix: closeTag
            }));
            return;
        }

        // 处理内联 <script>。
        if (!this.canParse(source, sourceIndex, openTag, innerHTML, closeTag, "script")) return;
        let type = getAttr(openTag, "type");
        this.parseInline(source, sourceIndex, openTag, innerHTML, closeTag, type && type !== "text/javascript" ? this.file.builder.getExtByMimeType(type) : ".js");
    }

    /**
     * 解析一个 `<style>` 标签。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     */
    protected parseStyle(source: string, sourceIndex: number, openTag: string, innerHTML: string, closeTag: string) {
        if (!this.canParse(source, sourceIndex, openTag, innerHTML, closeTag, "style")) return;
        let type = getAttr(openTag, "type");
        this.parseInline(source, sourceIndex, openTag, innerHTML, closeTag, type && type !== "text/css" ? this.file.builder.getExtByMimeType(type) : ".css");
    }

    /**
     * 存储当前内联标签的序号。
     */
    private _inlineCounter: number;

    /**
     * 解析 &lt;script&gt; 或 &lt;style&gt; 标签的内容。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     * @param ext 内联扩展名。
     */
    protected parseInline(source: string, sourceIndex: number, openTag: string, innerHTML: string, closeTag: string, ext: string) {
        if (hasDynamicTag(innerHTML)) return;

        // 创建虚拟文件。
        let builder = this.file.builder;
        var related = builder.createFile(this.file.name + "#inline" + (this._inlineCounter = (this._inlineCounter + 1) || 1) + ext, innerHTML);
        
        builder.processFile(related);
        
        let module = getModule(related, this.options);

        // // 之前引用的文件自动排除。
        // if (this._refs) {
        //     for (let i = 0; i < this._refs.length; i++) {
        //         module.external("(html: ref)", -1, this._refs[i], "html");
        //     }
        // }


        // 内联模块。
        let endIndex = sourceIndex + source.length;
        this.replace(sourceIndex, sourceIndex, openTag);
        this.replace(sourceIndex, endIndex, module);
        this.replace(endIndex, endIndex, closeTag);
    }

    /**
     * 解析一个 HTML 标签。
     * @param source 相关的代码片段。
     * @param sourceIndex 代码片段在源文件的起始位置。
     * @param tagName 解析的标签名。
     */
    protected parseTag(source: string, sourceIndex: number, tagName: string) {

        // 禁止解析。
        if (!this.canParse(source, sourceIndex, source, "", "", "src")) return;

        // <a href>, <base href>
        if (/^(?:a|base)$/i.test(tagName)) {
            let href = getAttrInfo(source, "href");
            if (href) {
                this.parseUrl(href.source, sourceIndex + href.index, href.value, "href", url => encodeAttr(url, href.source));
            }
            return;
        }

        // <link href>
        if (/^link$/i.test(tagName)) {
            let href = getAttrInfo(source, "href");
            if (href) {
                this.parseUrl(href.source, sourceIndex + href.index, href.value, "href", url => encodeAttr(url, href.source), () => getAttr(source, "rel") === "stylesheet" && {
                    prefix: removeAttr(removeAttr(source.replace(/link/i, "style").replace(/\s*\/>$/, ">"), "href"), "rel") + "\n",
                    postfix: "\n</style>"
                });
            }
            return;
        }

        // <form action>
        if (/^form$/i.test(tagName)) {
            let action = getAttrInfo(source, "action");
            if (action) {
                this.parseUrl(action.source, sourceIndex + action.index, action.value, "action", url => encodeAttr(url, action.source));
            }
            return;
        }

        // <input formaction>
        if (/^(?:input|button)$/i.test(tagName)) {
            let action = getAttrInfo(source, "formaction");
            if (action) {
                this.parseUrl(action.source, sourceIndex + action.index, action.value, "formaction", url => encodeAttr(url, action.source));
            }
            return;
        }

        // <object data>
        if (/^object$/i.test(tagName)) {
            let data = getAttrInfo(source, "data");
            if (data) {
                this.parseUrl(data.source, sourceIndex + data.index, data.value, "data", url => encodeAttr(url, data.source));
            }
            return;
        }

        // <img srcset>
        if (/^img$/i.test(tagName)) {
            // http://www.webkit.org/demos/srcset/
            // <img src="image-src.png" srcset="image-1x.png 1x, image-2x.png 2x, image-3x.png 3x, image-4x.png 4x">
            let srcset = getAttrInfo(source, "srcset");
            if (srcset) {
                srcset.source.replace(/((?:^|,)\s*)(.*)(\s+\dx)/g, (source: string, prefix: string, url: string, postfix: string, index2: number) => prefix + this.parseUrl(url, sourceIndex + srcset.index + index2, decodeAttr(url), "srcset", url => url) + postfix);
            }
        }

        // <* src>
        let src = getAttrInfo(source, "src");
        if (src) {
            this.parseUrl(src.source, sourceIndex + src.index, src.value, "src", url => encodeAttr(url, src.source));
        }

        // <* data-src>
        let dataSrc = getAttrInfo(source, "data-src");
        if (dataSrc) {
            this.parseUrl(dataSrc.source, sourceIndex + dataSrc.index, dataSrc.value, "data-src", url => encodeAttr(url, dataSrc.source));
        }

    }

    /**
     * 解析标签配置的值。
     * @param source 相关的代码片段。
     * @param sourceIndex *openTag* 在源文件的起始位置。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     * @param option 读取的配置键。
     * @returns 如果已解析完成则返回 @true，否则返回 @false。
     */
    protected canParse(source: string, sourceIndex: number, openTag: string, innerHTML: string, closeTag: string, option: string) {

        // 禁止解析标签。
        let options = this.options.html && this.options.html.tag;
        if (options === false) return false;

        // 检查 __skip 属性。
        if (getAttr(openTag, "__skip") !== null) {
            this.replace(sourceIndex, sourceIndex + openTag.length, removeAttr(openTag, "__skip"));
            return false;
        }

        if (!options) return true;
        let value = options[option];
        if (typeof value === "function") value = options[option](openTag, innerHTML, closeTag);
        return value;
    }

}

/**
 * 表示解析 HTML 模块的配置。
 */
export interface HtmlOptions extends ModuleOptions {

    /**
     * 解析 HTML 的配置。
     */
    html: {

        /**
         * 设置是否解析 HTML 标签。
         * @default true
         */
        tag?: {

            /**
             * 是否解析 &lt;style&gt; 标签。
             * @default true
             * @return 可能值有：
             * - true：全部解析。
             * - false: 全部不解析。
             * - 函数: 仅当函数返回 true 时解析。
             */
            style?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

            /**
             * 是否解析内联的 &lt;script&gt; 标签。
             * @default true
             * @return 可能值有：
             * - true：全部解析。
             * - false: 全部不解析。
             * - 函数: 仅当函数返回 true 时解析。
             */
            script?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

            /**
             * 是否解析 src, href 等包含地址的属性。
             * @default true
             * @return 可能值有：
             * - true：全部解析。
             * - false: 全部不解析。
             * - 函数: 仅当函数返回 true 时解析。
             */
            src?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

        }

    }

}

/**
 * 判断指定的源码是否包含动态语言标记。
 * @param source 相关的代码片段。
 */
function hasDynamicTag(source: string) {
    return /<[%?!#]|[%?!#]>/.test(source);
}

// #region 读写属性

/**
 * 获取 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 */
function getAttr(tag: string, attrName: string) {
    let match = getAttrRegExp(attrName).exec(tag);
    return match ? match[2] ? decodeAttr(match[4] != null ? match[4] : match[5] != null ? match[5] : match[3]) : "" : null;
}

/**
 * 获取 HTML 标签的属性信息。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 */
function getAttrInfo(tag: string, attrName: string) {
    // FIXME: 处理 <a <%= 'src="A"' %> > 的情况。
    let match = getAttrRegExp(attrName).exec(tag);
    return match && match[3] && !hasDynamicTag(match[3]) ? {
        source: match[3],
        index: match.index + match[1].length + match[2].length,
        value: decodeAttr(match[4] != null ? match[4] : match[5] != null ? match[5] : match[3])
    } : null;
}

/**
 * 设置 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 * @param attrValue 属性值。
 */
function setAttr(tag: string, attrName: string, attrValue: string) {
    let found = false;
    tag = tag.replace(getAttrRegExp(attrName), (all, name, eq, value, double, single) => {
        found = true;
        return name + (eq || "=") + encodeAttr(attrValue, double ? '"' : '\'');
    });
    return found ? tag : tag.replace(/^<[^\s]+\b/, all => all + " " + attrName + "=" + encodeAttr(attrValue, '"'));
}

/**
 * 删除 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 */
function removeAttr(tag: string, attrName: string) {
    return tag.replace(getAttrRegExp(attrName), "");
}

/**
 * 解码 HTML 特殊字符。
 * @param value 要解码的字符串。
 * @returns 返回已解码的字符串。
 * @example decodeAttr("&lt;a&gt;&lt;/a&gt;") // &amp;lt;a&amp;gt;&amp;lt;/a&amp;gt;
 */
function decodeAttr(value: string) {
    return value.replace(/&(#(\d{1,4})|\w+);/g, (_, word, unicode) => unicode ? String.fromCharCode(+unicode) : {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '\"'
    }[word] || word);
}

/**
 * 编码属性字符串。
 * @param value 属性值。
 * @param quote 使用的引号。
 */
function encodeAttr(value: string, quote: string) {
    return quote.charCodeAt(0) === 34/*"*/ ? '"' + value.replace(/"/g, "&quot;") + '"' :
        quote.charCodeAt(0) === 39/*'*/ ? "'" + value.replace(/'/g, "&#39;") + "'" :
            /[>\s="']/.test(value) ? encodeAttr(value, value.indexOf('"') >= 0 && value.indexOf('\'') < 0 ? '\'' : '"') : value;
}

var attrRegExp: { [key: string]: RegExp };

/**
 * 获取解析指定属性的正则表达式。
 * @param attrName 属性名。
 */
function getAttrRegExp(attrName: string) {
    if (!attrRegExp) attrRegExp = {};
    return attrRegExp[attrName] || (attrRegExp[attrName] = new RegExp("(\\s" + attrName + ')(?:(\\s*=\\s*)("([^"]*)"|\'([^\']*)\'|[^\\s>]*))?', "i"));
}

// #endregion