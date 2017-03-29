"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file 解析 JS 模块。
 */
const FS = require("fs");
const module_1 = require("./module");
/**
 * 表示一个 JS 模块。
 */
class JsModule extends module_1.BuildModule {
    /**
     * 获取当前模块的类型。
     */
    get type() { return module_1.ModuleType.js; }
    /**
     * 自动设置模块目标。
     * @param target 模块目标。
     */
    setDefaultTarget(target) {
        if (this.target == null) {
            this.target = target;
        }
    }
    /**
     * 解析当前模块。
     */
    parse() {
        this.content.replace(/'((?:[^\\'\n\r\f]|\\[\s\S])*)'|"((?:[^\\"\n\f]|\\[\s\S])*)"|\/((?:[^\\\/\n\f]|\\[\s\S])+)\/|\/\/([^\n\f]+)|\/\*([\s\S]*?)(?:\*\/|$)|((?:^|[^\.])require\s*\(\s*)('(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*")\s*\)\s*;?|(^|[^\.])(setImmediate|clearImmediate|process|module|exports|require|global|Buffer|__dirname|__filename)\b/g, (source, singleString, doubleString, regExp, singleComment, multiComment, requirePrefix, require, keywordPrefix, keyword, sourceIndex) => {
            // '...', "..."
            if (singleString != null || doubleString != null || regExp != null)
                return "";
            // //..., /*...*/
            if (singleComment != null || multiComment != null) {
                this.parseComment(source, sourceIndex, singleComment || multiComment, sourceIndex + 2);
                return "";
            }
            // require('...')
            if (require != null) {
                this.parseRequire(source, sourceIndex, require, sourceIndex + requirePrefix.length);
                return "";
            }
            // require, exports, module, process, global, Buffer, setImmediate, clearImmediate, __dirname, __filename
            if (keyword != null) {
                this.parseKeyword(keyword, sourceIndex + keywordPrefix.length);
                return "";
            }
            return "";
        });
    }
    /**
     * 解析 require(url)。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 相关的地址。
     * @param urlIndex *url* 在源文件的起始位置。
     */
    parseRequire(source, sourceIndex, url, urlIndex) {
        if (this.options.js && this.options.js.require === false)
            return;
        this.setDefaultTarget(module_1.ModuleTarget.tpack);
        let obj = this.resolveUrl(url, urlIndex, module_1.decodeString(url), module_1.UrlUsage.require);
        if (!obj)
            return;
        // 导出 CSS 后删除 require 调用。
        if (this.extractCss && obj.module.type === module_1.ModuleType.css) {
            this.extractCss.require(url, urlIndex, obj.module, "require");
            this.replace(sourceIndex, sourceIndex + source.length, "");
            return;
        }
        this.require(url, urlIndex, obj.module, "require");
        this.replace(urlIndex, urlIndex + url.length, module_1.encodeString(prependDot(this.file.relative(obj.module.file) + obj.query + obj.hash), url));
    }
    /**
     * 解析一个文件内的符号。
     * @param source 要处理的内容。
     * @param index *source* 在源文件的起始位置。
     * @param keyword 要解析的符号。
     */
    parseKeyword(source, index) {
        let options = this.options.js && this.options.js.keyword;
        if (options === false || options && options[source] === false)
            return;
        this._parsedKeywords = this._parsedKeywords || [];
        if (this._parsedKeywords.indexOf(source) >= 0)
            return;
        this._parsedKeywords.push(source);
        let requireModule;
        let prepend;
        switch (source) {
            case "require":
            case "exports":
            case "module":
                this.setDefaultTarget(module_1.ModuleTarget.tpack);
                break;
            case "global":
                prepend = 'var global = (function(){return this;})();\n';
                break;
            case "process":
                requireModule = "process";
                prepend = 'var Buffer = require(~);\n';
                break;
            case "Buffer":
                requireModule = "buffer";
                prepend = 'var Buffer = require(~);\n';
                break;
            case "setImmediate":
            case "clearImmediate":
                requireModule = "timers";
                prepend = `var ${source} = require(~).${source};\n`;
                break;
            case "__dirname":
                prepend = `var __dirname = ${JSON.stringify(this.file.srcDir)};\n`;
            case "__filename":
                prepend = `var __filename = ${JSON.stringify(this.file.srcPath)};\n`;
                break;
        }
        // 如果需要额外请求模块。
        if (requireModule && (!this.options.resolve || this.options.resolve.native !== false)) {
            this.setDefaultTarget(module_1.ModuleTarget.tpack);
            if (this.target !== module_1.ModuleTarget.tpack)
                return;
            let module = this.resolveRequire(source, index, requireModule, "auto require");
            if (!module)
                return;
            prepend = prepend.replace("~", JSON.stringify(prependDot(this.file.relative(module.path))));
        }
        // 追加文本内容。
        if (prepend) {
            this.replace(0, 0, prepend);
        }
    }
    /**
     * 将当前模块及依赖项写入的指定的输出器。
     * @param writer 目标输出器。
     */
    write(writer) {
        if (this.target === module_1.ModuleTarget.tpack && (!this.externals || !this.externals.length)) {
            writer.write(getLoader());
        }
        super.write(writer);
    }
    /**
     * 写入一个模块。
     * @param writer 目标输出器。
     * @param module 要写入的模块。
     */
    writeModule(writer, module) {
        if (this.target !== module_1.ModuleTarget.tpack) {
            super.writeModule(writer, module);
            return;
        }
        writer.write('\n\n__tpack__.define(');
        if (module !== writer.file.webModule) {
            writer.write(JSON.stringify(prependDot(this.file.relative(module.file))) + ", ");
        }
        writer.indentString = this.options.output && this.options.output.sourcePrefix != null ? this.options.output.sourcePrefix : "\t";
        writer.write('function(require, exports, module) {\n');
        switch (module.type) {
            case module_1.ModuleType.js:
                super.writeModule(writer, module);
                break;
            case module_1.ModuleType.css:
                writer.write(`module.exports = __tpack__.insertStyle(${JSON.stringify(module.file.content)});`);
                break;
            case module_1.ModuleType.json:
                writer.write(`module.exports = `);
                module.write(writer);
                writer.write(`;`);
                break;
            default:
                writer.write(`module.exports = ${JSON.stringify(module.file.content)};`);
                break;
        }
        writer.indentString = "";
        writer.write(`\n});`);
    }
}
exports.JsModule = JsModule;
/**
 * 存储加载器源码。
 */
var loader;
/**
 * 获取加载器源码。
 * @return 返回加载器源码。
 */
function getLoader() {
    return loader || (loader = FS.readFileSync(require.resolve("../loader/require.js"), "utf-8"));
}
/**
 * 在路径前追加 '.'。
 * @param value 要追加的字符串。
 * @return 返回已追加的字符串。
 */
function prependDot(value) {
    return value.charCodeAt(0) === 46 /*.*/ ? value : "./" + value;
}
//# sourceMappingURL=js.js.map