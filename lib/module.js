"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file 模块基类。
 */
const Path = require("path");
const IO = require("tutils/node/io.js");
/**
 * 表示一个生成模块。
 * @remark
 * 一个生成模块代表一个物理文件。
 */
class BuildModule {
    /**
     * 初始化新的模块。
     * @param file 当前模块的源文件。
     * @param options 当前模块的解析配置。
     */
    constructor(file, options) {
        this.file = file;
        this.options = options;
    }
    /**
     * 获取当前模块在模块化之前的源文件。
     */
    get source() {
        if (!this._source) {
            this._source = this.file.builder.createFile(this.file.srcName, this.file.data);
            this._source.sourceMapData = this.file.sourceMapData;
            this._source.emitSourceMapUrl(null);
        }
        return this._source;
    }
    /**
     * 获取当前模块的类型。
     */
    get type() { return this.source.isText ? ModuleType.text : ModuleType.binary; }
    /**
     * 获取当前模块的源地址。
     */
    get path() { return this.source.srcPath; }
    /**
     * 获取当前模块的源内容。
     */
    get content() {
        return this.type <= ModuleType.binary ? this.source.getBase64Url() : this.source.content;
    }
    /**
     * 获取当前对象的等效字符串。
     */
    toString() { return this.path; }
    // #endregion
    // #region 依赖关系
    /**
     * 标记当前模块引用了指定的模块。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param module 引用的模块。
     * @param name 引用的来源名。
     */
    ref(source, sourceIndex, module, name) {
        this.file.ref(module.path, this.source.captureLocation(source, sourceIndex, {
            plugin: "webModular",
            name: name
        }));
    }
    /**
     * 标记当前模块包含了指定的模块。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param module 包含的模块。
     * @param name 包含的来源名。
     * @return 如果存在循环包含，返回 false，否则返回 true。
     */
    include(source, sourceIndex, module, name) {
        // 如果目标模块已包含当前模块，则认为是循环引用。
        if (module.hasIncluded(this))
            return false;
        // 不重复包含相同的模块。
        this.includes = this.includes || [];
        if (this.includes.indexOf(module) < 0)
            this.includes.push(module);
        // 记录文件包含关系。
        this.file.dep(module.path, this.source.captureLocation(source, sourceIndex, {
            plugin: "webModular",
            name: name
        }));
        return true;
    }
    /**
     * 判断当前模块及已包含的模块是否包含了指定模块。
     * @param module 相关的模块。
     */
    hasIncluded(module) {
        // 模块已包含自身。
        if (this === module)
            return true;
        // 任何一个模块依赖项包含目标模块，则认为已包含。
        if (this.includes) {
            for (let i = 0; i < this.includes.length; i++) {
                if (this.includes[i].hasIncluded(module)) {
                    return true;
                }
            }
        }
        // 模块未包含。
        return false;
    }
    /**
     * 标记当前模块依赖了指定的模块。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param module 依赖的模块。
     * @param name 依赖的来源名。
     */
    require(source, sourceIndex, module, name) {
        // 不依赖自身。
        if (module === this)
            return;
        // 不重复依赖相同的模块。
        this.requires = this.requires || [];
        if (this.requires.indexOf(module) < 0)
            this.requires.push(module);
        // 记录文件包含关系。
        this.file.dep(module.path, this.source.captureLocation(source, sourceIndex, {
            plugin: "webModular",
            name: name
        }));
    }
    /**
     * 获取当前模块的最终依赖列表（包括模块本身）。
     */
    getAllRequires() {
        let result = new Array();
        this._addToRequireList(result, this.getAllExternals());
        return result;
    }
    /**
     * 将当前模块及依赖项添加到指定的数组。
     * @param target 目标数组。
     * @param externals 添加时应排除的模块。
     */
    _addToRequireList(target, externals) {
        // 已排除则不再处理，已处理的文件同时添加到排除列表。
        if (externals.indexOf(this) >= 0)
            return;
        externals.push(this);
        // 递归依赖。
        if (this.requires) {
            for (let i = 0; i < this.requires.length; i++) {
                this.requires[i]._addToRequireList(target, externals);
            }
        }
        // 添加依赖。
        target.push(this);
    }
    /**
     * 标记当前模块排除了指定的模块。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param module 排除的模块。
     * @param name 排除的来源名。
     */
    external(source, sourceIndex, module, name) {
        // 不重复排除相同的模块。
        this.externals = this.externals || [];
        if (module !== this && this.externals.indexOf(module) < 0)
            this.externals.push(module);
        // 排除模块的变化也会影响当前模块，记录文件包含关系。
        this.file.dep(module.path, this.source.captureLocation(source, sourceIndex, {
            plugin: "webModular",
            name: name
        }));
    }
    /**
     * 获取当前模块的最终排除列表。
     */
    getAllExternals() {
        let result = new Array();
        if (this.externals) {
            for (let i = 0; i < this.externals.length; i++) {
                this.externals[i]._addToExternalList(result);
            }
        }
        return result;
    }
    /**
     * 将当前模块及依赖添加到指定的排除数组。
     * @param target 目标数组。
     */
    _addToExternalList(target) {
        // 已排除则不再处理。
        if (target.indexOf(this) >= 0)
            return;
        target.push(this);
        // 排除一个模块，即排除这个模块及依赖和排除项。
        // 排除模块所依赖的模块，也可直接排除。
        if (this.requires) {
            for (let i = 0; i < this.requires.length; i++) {
                this.requires[i]._addToExternalList(target);
            }
        }
        // 排除模块所排除的模块，继承其排除性。
        if (this.externals) {
            for (let i = 0; i < this.externals.length; i++) {
                this.externals[i]._addToExternalList(target);
            }
        }
    }
    /**
     * 添加一个替换操作。
     * @param startIndex 原始内容的起始位置。
     * @param endIndex 原始内容的结束位置（不包括结束位置）。
     * @param data 替换记录的数据。如果不提供数据则表示删除。
     * @return 返回插入的位置，如果插入失败则返回 -1。
     */
    replace(startIndex, endIndex, data) {
        if (startIndex === 16721)
            debugger;
        console.assert(startIndex <= endIndex);
        console.assert(endIndex <= this.content.length);
        // 如果最新替换记录在最末尾，则快速插入。
        let replacements = this.replacements || (this.replacements = []);
        if (startIndex >= this._lastReplacementEndIndex) {
            this._lastReplacementEndIndex = endIndex;
            return replacements.push({ startIndex, endIndex, data });
        }
        // 根据排序规则查找插入点。
        let p = replacements.length;
        while (p) {
            let r = replacements[p - 1];
            if (startIndex >= r.startIndex) {
                // 无法插入到上一个替换点中间：忽略当前更新操作。
                if (startIndex < r.endIndex || (p < replacements.length && endIndex > replacements[p].startIndex)) {
                    return -1;
                }
                break;
            }
            p--;
        }
        // 插入到指定位置。
        this._lastReplacementEndIndex = endIndex;
        replacements.splice(p, 0, { startIndex, endIndex, data });
        return p;
    }
    /**
     * 开始一个隐藏区域。隐藏区域内的代码会被删除。
     * @param sourceIndex 区域的索引。
     */
    beiginHiddenRegion(sourceIndex) {
        if (this._hideCount === 0) {
            this.replacements.push({ startIndex: sourceIndex, endIndex: this.content.length + 1, data: "" });
        }
        this._hideCount++;
    }
    /**
     * 退出隐藏区域。
     * @param sourceIndex 区域的索引。
     */
    endHiddenRegion(sourceIndex) {
        this._hideCount--;
        if (this._hideCount === 0) {
            this.replacements[this.replacements.length - 1].endIndex = sourceIndex;
        }
    }
    // #endregion
    // #region 模块生成
    /**
     * 将模块信息保存到源文件。
     */
    save() {
        let options = this.options.output;
        let writer = this.file.createWriter(options && options.sourceMap != null ? options.sourceMap : !!this.file.sourceMap);
        // 写入文件头。
        if (options && options.prefix)
            writer.write(this.file.format(options.prefix));
        // 写入当前模块。
        this.write(writer);
        // 写入文件尾。
        if (options && options.postfix)
            writer.write(this.file.format(options.postfix));
        // 保存到文件。
        writer.end();
        // 保存导出的 CSS 文件。
        if (this.extractCss) {
            this.extractCss.save();
        }
    }
    /**
     * 将当前模块及依赖项写入的指定的输出器。
     * @param writer 目标输出器。
     * @param moduleList 手动指定写入的模块列表。
     */
    write(writer, moduleList = this.getAllRequires()) {
        let options = this.options.output;
        for (let i = 0; i < moduleList.length; i++) {
            let module = moduleList[i];
            // 写入模块分隔符。
            if (i > 0 && options && options.moduleSeperator !== "") {
                writer.write(options.moduleSeperator || "\n");
            }
            // 写入模块头。
            if (options && options.modulePrefix) {
                writer.write(module.file.format(options.modulePrefix));
            }
            // 写入模块。
            this.writeModule(writer, module);
            // 写入模块尾。
            if (options && options.modulePostfix) {
                writer.write(module.file.format(options.modulePostfix));
            }
        }
    }
    /**
     * 写入一个模块。
     * @param writer 目标输出器。
     * @param module 要写入的模块。
     */
    writeModule(writer, module) {
        // 当前模块未作修改：全部写入。
        let replacements = module.replacements;
        if (!replacements || !replacements.length) {
            writer.write(module.content, module.source, 0);
            return;
        }
        // 依次输出每个替换点。
        // 记录最后一次输出位置。
        let p = 0;
        for (let i = 0; i < replacements.length; i++) {
            let replacement = replacements[i];
            // 输出上一次替换到这次更新记录中间的普通文本。
            replacement.startIndex > p && writer.write(module.content.substring(p, replacement.startIndex), module.source, p);
            // 输出本次替换。
            switch (typeof replacement.data) {
                case "string":
                    writer.write(replacement.data, module.source, replacement.startIndex);
                    break;
                case "function":
                    writer.write(replacement.data(writer.file.webModule), module.source, replacement.startIndex);
                    break;
                case "object":
                    replacement.data.write(writer);
                    break;
            }
            // 更新最后一次替换位置。
            p = replacement.endIndex;
        }
        // 输出最后一段替换到文本结束的普通文本。
        module.content.length > p && writer.write(module.content.substring(p), module.source, p);
    }
    // #endregion
    // #region 解析公用
    /**
     * 从文件载入模块信息。
     */
    load() {
        // 设置解析目标。
        let target = this.options.target;
        if (target)
            this.resolveTarget("(options: target)", -1, target);
        // 手动添加依赖。
        let requires = this.options.requires;
        if (requires) {
            for (let i = 0; i < requires.length; i++) {
                this.resolveRequire(`(options: requires[${i}])`, -1, requires[i], "options: requires");
            }
        }
        // 手动添加排除。
        let externals = this.options.externals;
        if (externals) {
            for (let i = 0; i < externals.length; i++) {
                this.resolveExternal(`(options: externals[${i}])`, -1, externals[i], "options: externals");
            }
        }
        // 导出 CSS
        let extractCss = this.options.extract && this.options.extract.css;
        if (extractCss) {
            if (typeof extractCss === "function")
                extractCss = this.options.extract.css(this.file);
            if (extractCss !== false) {
                this.resolveExtractCss("(options: extract.css)", -1, extractCss === true ? "" : extractCss);
            }
        }
        // 跳过解析当前模块。
        if (this.options.noParse)
            return;
        // 禁用内联文件的源映射。
        if (this.path.indexOf("#") >= 0 && this.options.output && this.options.output.sourceMap) {
            this.options.output = this.options.output || {};
            this.options.output.sourceMap = false;
        }
        // 解析模块。
        this.parse();
        // 解析宏。
        this.parseSubs();
    }
    /**
     * 报告错误或警告。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param message 错误的信息。
     * @param args 格式化参数。如设置 {a:1}，那么 @message 中的 {a} 会被替换为 1。
     * @param warning 是否弱化错误为警告。
     * @param error 原始错误信息。
     */
    report(source, sourceIndex, message, args, warning, error) {
        let err = this.source.captureLocation(source, sourceIndex, {
            name: warning ? "WebModularWarning" : "WebModularError",
            error: error,
            message: this.file.builder.format(message, args),
            fileName: this.path
        });
        warning ? this.file.warning(err) : this.file.error(err);
    }
    /**
     * 解析当前模块内指定相对地址实际所表示的地址。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 要处理的相对地址。
     * @param usage 地址的使用场景。
     * @returns 如果解析成功则返回包含地址信息的对象；否则返回 null。
     */
    resolveUrl(source, sourceIndex, url, usage) {
        let options = this.options.resolve;
        // 自定义解析。
        if (options && options.parse) {
            url = options.parse(url, this.file, usage) || url;
        }
        // 解析别名。
        let originalUrl = url;
        url = resolveAlias(options && options.alias, url) || url;
        // 跳过 'http://'、'//' 和 'data:' 形式的地址。
        if (/^\w\w+:|^\/\//.test(url)) {
            if (usage === UrlUsage.local) {
                let nonLocal = options && options.nonLocal;
                if (typeof nonLocal === "function")
                    nonLocal = options.nonLocal(url, this.file, usage);
                if (nonLocal !== false && nonLocal !== "ignore") {
                    this.report(source, sourceIndex, "Cannot resolve non-local url: '{url}'.", { url }, nonLocal === "warning");
                }
            }
            return;
        }
        // 自定义跳过指定地址。
        if (options && options.skip && options.skip(url, this.file, usage))
            return;
        // 拆分地址。
        let parts = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
        let resolved = parts[1];
        let local;
        // 解析地址。
        if (usage === UrlUsage.require && (!options || options.commonJs !== false)) {
            // 标记是否完全按 nodejs 方式搜索模块。
            let nodejs = this.target === ModuleTarget.nodejs;
            // 计算要填充的扩展名。
            let extensions = options && options.extensions || (nodejs ? ["", ".node", ".json", ".js"] : ["", ".json", ".js", ".css", ".tpl"]);
            // 区分搜索相对路径还是全局模块。
            let c = resolved.charCodeAt(0);
            if (c === 46 /*.*/ || c === 47 /*/*/) {
                local = tryExtensions(resolved = this.file.resolve(resolved), extensions);
            }
            else {
                // 使用缓存。
                let cache = !options || options.cache !== false;
                if (cache) {
                    this._globalModulesCache = this._globalModulesCache || { __proto__: null };
                    local = this._globalModulesCache[resolved];
                }
                if (local == null) {
                    // 搜索内置模块。
                    if (!options || options.native !== false) {
                        local = getNativeModulePath(resolved);
                        // 打包为 NodeJs 时，不需要处理 Node 内置模块。
                        if (nodejs && local !== undefined)
                            return;
                    }
                    // 搜索 node_modules。
                    if (local == null) {
                        local = tryPackage(this.file.srcDir, resolved, options && options.modulesDirectories || (nodejs ? ["node_modules"] : ["web_modules", "node_modules"]), options && options.packageMains || (nodejs ? ["main"] : ["browser", "web", "browserify", "main"]), extensions);
                    }
                    // 搜索根目录。
                    if (local == null && options && options.root != null) {
                        if (typeof options.root === "string") {
                            local = tryExtensions(Path.resolve(this.file.builder.basePath, options.root, resolved), extensions);
                        }
                        else {
                            for (let i = 0; i < options.root.length; i++) {
                                if ((local = tryExtensions(Path.resolve(this.file.builder.basePath, options.root[i], resolved), extensions)) != null) {
                                    break;
                                }
                            }
                        }
                    }
                    // 保存缓存。
                    if (cache) {
                        this._globalModulesCache[resolved] = local;
                    }
                }
            }
        }
        else {
            local = IO.existsFile(resolved = this.file.resolve(resolved)) ? resolved : null;
        }
        // 执行 fallback。
        if (local == null && options && options.fallback) {
            local = IO.existsFile(resolved = options.fallback(url, this.file, usage)) ? resolved : null;
        }
        // 最终没找到模块。
        if (local == null) {
            let notFound = options && options.notFound;
            if (typeof notFound === "function")
                notFound = options.notFound(resolved, this.file, usage);
            if (notFound !== false && notFound !== "ignore") {
                this.report(source, sourceIndex, usage === UrlUsage.require ? "Cannot find module: '{path}'." : "Cannot find file: '{path}'.", { path: resolved }, usage === UrlUsage.inline || notFound === "warning");
            }
            return;
        }
        // 解析模块并返回结果。
        return {
            module: getModule(this.file.builder.getFile(local), this.options),
            query: parts[2] || "",
            hash: parts[3] || "",
            alias: originalUrl != url ? originalUrl.replace(/[?#].*$/, "") : null
        };
    }
    /**
     * 解析 #target target。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param target 设置的类型。
     * @returns 解析后的模块类型。如果解析错误则返回 null。
     */
    resolveTarget(source, sourceIndex, target) {
        let parsed = ModuleTarget[target.toLowerCase()];
        if (parsed == null) {
            this.report(source, sourceIndex, "Invalid target: '{target}'. Supported target is one of {supportedTarget}.", { target, supportedTarget: "'browser', 'nodejs', 'tpack', 'requirejs'" }, true);
        }
        return this.target = parsed;
    }
    /**
     * 解析 #require url。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 依赖的地址。
     * @param name 依赖的来源名。
     * @returns 返回依赖的模块。如果解析错误则返回 null。
     */
    resolveRequire(source, sourceIndex, url, name) {
        let obj = this.resolveUrl(source, sourceIndex, url, UrlUsage.require);
        if (!obj)
            return null;
        this.require(source, sourceIndex, obj.module, name);
        return obj.module;
    }
    /**
     * 解析 #external url。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 排除的地址。
     * @param name 排除的来源名。
     * @returns 返回排除的模块。如果解析错误则返回 null。
     */
    resolveExternal(source, sourceIndex, url, name) {
        let obj = this.resolveUrl(source, sourceIndex, url, UrlUsage.require);
        if (!obj)
            return null;
        this.external(source, sourceIndex, obj.module, name);
        return obj.module;
    }
    /**
     * 解析 #include url。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 包含的地址。
     * @param name 包含的来源名。
     * @returns 返回包含的模块。如果解析错误则返回 null。
     */
    resolveInclude(source, sourceIndex, url, name) {
        let obj = this.resolveUrl(source, sourceIndex, url, UrlUsage.local);
        if (!obj)
            return null;
        if (!this.include(source, sourceIndex, obj.module, name)) {
            this.report(source, sourceIndex, "Circular include with '{path}'.", { path: obj.module.file.displayName });
            return null;
        }
        return obj.module;
    }
    /**
     * 解析 #extract-css url。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 导出的地址。
     * @return 返回导出的模块。
     */
    resolveExtractCss(source, sourceIndex, url) {
        url = url ? this.file.resolve(this.file.format(url)) : this.file.srcName.replace(/\.\w+$/, "") + ".css";
        let file = this.file.builder.createFile(url);
        this.file.relate(file);
        return this.extractCss = new (require("./css").CssModule)(file, this.options);
    }
    // #endregion
    // #region 解析地址
    /**
     * 解析内联地址。如 __url(url) 和 HTML/CSS 的 URL。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param url 要解析的相对路径。
     * @param name 引用的来源名。
     * @param encoder 编码地址的回调函数。
     * @param textInliner 当以文本格式内联时的回调函数，自定义前后缀。
     */
    parseUrl(source, sourceIndex, url, name, encoder, textInliner) {
        // 禁止解析地址。
        let options = this.options.url;
        if (options === false || url.indexOf("__skip") >= 0)
            return;
        // 解析地址。
        let obj = this.resolveUrl(source, sourceIndex, url, UrlUsage.inline);
        if (!obj)
            return;
        let endIndex = sourceIndex + source.length;
        // 内联。
        let inlineLimit = resolveQuery(obj, "__inline");
        if (inlineLimit == null) {
            inlineLimit = options && options.inline;
            if (inlineLimit != null) {
                if (typeof inlineLimit === "function")
                    inlineLimit = options.inline(this.file, obj);
                if (typeof inlineLimit === "boolean")
                    inlineLimit = inlineLimit ? -1 : 0;
            }
        }
        if (inlineLimit < 0 || inlineLimit && obj.module.file.buffer.length < inlineLimit) {
            if (textInliner) {
                let prefixAndPostfix = textInliner();
                if (prefixAndPostfix) {
                    if (this.include(source, sourceIndex, obj.module, "inline")) {
                        this.replace(sourceIndex, endIndex, prefixAndPostfix.prefix);
                        this.replace(endIndex, endIndex, obj.module);
                        this.replace(endIndex, endIndex, prefixAndPostfix.postfix);
                        return;
                    }
                    this.report(source, sourceIndex, "Circular include with '{file}'.", { file: obj.module.file.displayName });
                }
            }
            else {
                if (this.include(source, sourceIndex, obj.module, "inline")) {
                    this.replace(sourceIndex, endIndex, module => encoder(obj.module.file.getBase64Url()));
                    return;
                }
                this.report(source, sourceIndex, "Circular include with '{file}'.", { file: obj.module.file.displayName });
            }
        }
        // 重写地址。
        this.ref(source, sourceIndex, obj.module, name);
        this.replace(sourceIndex, endIndex, module => encoder(module.buildUrl(obj)));
    }
    /**
     * 生成最终保存到文件的地址。
     * @param urlInfo 地址信息。
     * @return 返回生成的地址。
     */
    buildUrl(urlInfo) {
        let options = this.options.url;
        // 添加后缀。
        let newQuery = (urlInfo.module || this).file.format(urlInfo.query);
        if (newQuery === urlInfo.query) {
            let postfix = options && options.postfix;
            if (postfix) {
                let orignalQuery = urlInfo.query;
                if (resolveQuery(urlInfo, "__postfix") !== 0) {
                    if (typeof postfix === "function")
                        postfix = options.postfix(urlInfo, this.file);
                    if (postfix) {
                        newQuery = urlInfo.query + (urlInfo.query ? '&' : '?') + (urlInfo.module || this).file.format(postfix);
                    }
                }
                else {
                    newQuery = urlInfo.query;
                    urlInfo.query = orignalQuery;
                }
            }
        }
        if (options) {
            // 自定义逻辑。
            if (options.build) {
                let orignalQuery = urlInfo.query;
                urlInfo.query = newQuery;
                let result = options.build(urlInfo, this.file);
                urlInfo.query = orignalQuery;
                if (result != null)
                    return result;
            }
            // 尝试使用公开路径。
            let url = resolveAlias(options.public, urlInfo.module.file.srcName);
            if (url) {
                return url + newQuery + urlInfo.hash;
            }
        }
        // 使用相对地址。
        return (urlInfo.alias ? urlInfo.alias : this.file.relative(urlInfo.module.file)) + newQuery + urlInfo.hash;
    }
    // #endregion
    // #region 解析注释
    /**
     * 解析一段注释。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param comment 注释。
     * @param commentIndex *comment* 在源文件的起始位置。
     */
    parseComment(source, sourceIndex, comment, commentIndex) {
        // 禁止解析注释。
        let options = this.options.comment;
        if (options === false)
            return;
        // 解析注释。
        let foundSub = false;
        comment.replace(/(#(include|external|require|target|if|else|elif|endif|region|endregion|error|warning|extract\-css)\s*)(.*)/g, (source2, prefix, name, arg, sourceIndex2) => {
            // 禁止解析指定注释。
            if (options && options[({ else: "if", elif: "if", endif: "if", endregion: "region" })[name] || name] === false)
                return "";
            sourceIndex2 += commentIndex;
            let argIndex = sourceIndex2 + prefix.length;
            foundSub = true;
            switch (name) {
                case "include":
                    let related = this.resolveInclude(arg, argIndex, trimQuotes(arg), "#include");
                    if (related) {
                        this.replace(sourceIndex, sourceIndex, related);
                    }
                    break;
                case "require":
                    this.resolveRequire(arg, argIndex, trimQuotes(arg), "#require");
                    break;
                case "external":
                    this.resolveExternal(arg, argIndex, trimQuotes(arg), "#external");
                    break;
                case "target":
                    this.resolveTarget(arg, argIndex, trimQuotes(arg));
                    break;
                case "if":
                    this.resolveIfDirective(source2, sourceIndex2, arg, argIndex);
                    break;
                case "elif":
                    this.resolveElifDirective(source2, sourceIndex2, arg, argIndex);
                    break;
                case "else":
                    this.resolveElseDirective(source2, sourceIndex2, arg, argIndex);
                    break;
                case "endif":
                    this.resolveEndIfDirective(source2, sourceIndex2);
                    break;
                case "region":
                    this.resolveRegionDirective(source2, sourceIndex2, arg, argIndex);
                    break;
                case "endregion":
                    this.resolveEndRegionDirective(source2, sourceIndex2);
                    break;
                case "error":
                    this.resolveErrorDirective(source2, sourceIndex2, trimQuotes(arg));
                    break;
                case "warning":
                    this.resolveWarningDirective(source2, sourceIndex2, trimQuotes(arg));
                    break;
                case "extract-css":
                    this.resolveExtractCss(arg, argIndex, trimQuotes(arg));
                    break;
            }
            return "";
        });
        // 删除注释。
        if (foundSub) {
            this.replace(sourceIndex, sourceIndex + source.length, "");
        }
    }
    /**
     * 解析 #if expression。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param expression 宏表达式。
     * @param expressionIndex *expression* 在源文件的起始位置。
     */
    resolveIfDirective(source, sourceIndex, expression, expressionIndex) {
        let value = this.resolveMacro(expression, expressionIndex, expression) !== false;
        // 执行 #if
        this._ifStack = this._ifStack || [];
        this._ifStack.unshift({ item: IfStackItem.if, value: value });
        // 进入 #if false
        if (!value)
            this.beiginHiddenRegion(sourceIndex);
    }
    /**
     * 解析 #elif expression。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param expression 宏表达式。
     * @param expressionIndex *expression* 在源文件的起始位置。
     */
    resolveElifDirective(source, sourceIndex, expression, expressionIndex) {
        if (!this._ifStack || !this._ifStack.length || this._ifStack[0].item !== IfStackItem.if) {
            this.report(source, sourceIndex, "Mismatched #elif directive. Do you miss a #if?", null, true);
            return;
        }
        // 执行 #else
        this.resolveElseDirective(source, sourceIndex, null, -1);
        // 更新为 #elif
        this._ifStack[0].item = IfStackItem.elif;
        // 执行 #if
        this.resolveIfDirective(source, sourceIndex, expression, expressionIndex);
    }
    /**
     * 解析 #else。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param expression 宏表达式。
     * @param expressionIndex *expression* 在源文件的起始位置。
     */
    resolveElseDirective(source, sourceIndex, expression, expressionIndex) {
        if (!this._ifStack || !this._ifStack.length || this._ifStack[0].item !== IfStackItem.if) {
            this.report(source.substr(0, "#else".length), sourceIndex, "Mismatched #else directive. Do you miss a #if?", null, true);
            return;
        }
        if (expression) {
            this.report(expression, expressionIndex, "Unexpected expression after #else directive. Do you mean '#elif'?", null, false);
        }
        // 退出 #if false
        if (!this._ifStack[0].value)
            this.endHiddenRegion(sourceIndex + source.length);
        // 执行 #else
        this._ifStack[0].item = IfStackItem.else;
        this._ifStack[0].value = !this._ifStack[0].value;
        // 进入 #else false
        if (!this._ifStack[0].value)
            this.beiginHiddenRegion(sourceIndex);
    }
    /**
     * 解析 #endif。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     */
    resolveEndIfDirective(source, sourceIndex) {
        if (!this._ifStack || !this._ifStack.length || (this._ifStack[0].item !== IfStackItem.if && this._ifStack[0].item !== IfStackItem.else)) {
            this.report(source.substr(0, "#endif".length), sourceIndex, "Mismatched #endif directive. Do you miss a #if?", null, true);
            return;
        }
        // 退出 #if false 或 #else false
        if (!this._ifStack.shift().value)
            this.endHiddenRegion(sourceIndex + source.length);
        // 删除自动追加的 #elif
        while (this._ifStack.length && this._ifStack[0].item === IfStackItem.elif) {
            if (!this._ifStack.shift().value)
                this.endHiddenRegion(sourceIndex + source.length);
        }
    }
    /**
     * 解析 #region name。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param name 名字。
     * @param nameIndex *name* 在源文件的位置。
     */
    resolveRegionDirective(source, sourceIndex, name, nameIndex) {
        let value = this.options.region ? this.options.region[name.trim()] !== false : true;
        // 执行 #region
        this._ifStack = this._ifStack || [];
        this._ifStack.unshift({ item: IfStackItem.region, value: value });
        // 进入 #region false
        if (!value)
            this.beiginHiddenRegion(sourceIndex);
    }
    /**
     * 解析 #endregion。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     */
    resolveEndRegionDirective(source, sourceIndex) {
        if (!this._ifStack || !this._ifStack.length || this._ifStack[0].item !== IfStackItem.region) {
            this.report(source.substr(0, "#endregion".length), sourceIndex, "Mismatched #endregion directive. Do you miss a #region?", null, true);
            return;
        }
        // 退出 #region false
        if (!this._ifStack.shift().value)
            this.endHiddenRegion(sourceIndex + source.length);
    }
    /**
     * 解析 #error message。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param message 语句的参数。
     */
    resolveErrorDirective(source, sourceIndex, message) {
        this.report(source, sourceIndex, message);
    }
    /**
     * 解析 #warning message。
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param message 语句的参数。
     * @return 返回宏编译结果。
     */
    resolveWarningDirective(source, sourceIndex, message) {
        this.report(source, sourceIndex, message, null, true);
    }
    // #endregion
    // #region 解析宏
    /**
     * 解析宏。
     */
    parseSubs() {
        // 禁止解析宏。
        let options = this.options.sub;
        if (options === false)
            return;
        // 解析宏。
        this.content.replace(/\b(__(url|skip|postfix|macro|include|external|require|target)\s*\(\s*)('(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*"|[^)\r\n]*)\s*\)/g, (source, prefix, name, arg, sourceIndex) => {
            // 禁止解析指定宏。
            if (options && options[name] === false)
                return "";
            // 处理参数。
            let argValue = decodeString(arg);
            let argIndex = sourceIndex + prefix.length;
            switch (name) {
                case "url":
                    this.parseUrl(source, sourceIndex, argValue, "__url", this.type === ModuleType.html ? url => url : url => encodeString(url, arg));
                    return "";
                case "skip":
                    break;
                case "macro":
                    let value = this.resolveMacro(arg, argIndex, argValue);
                    arg = this.type === ModuleType.html ? value : encodeString(value, arg);
                    break;
                case "include":
                    let related = this.resolveInclude(arg, argIndex, argValue, "__include");
                    if (!related)
                        return "";
                    arg = this.type === related.type ? related : encodeString(related.file.content, arg);
                    break;
                case "external":
                    this.resolveExternal(arg, argIndex, argValue, "__external");
                    arg = "";
                    break;
                case "require":
                    this.resolveRequire(arg, argIndex, argValue, "__require");
                    arg = "";
                    break;
                case "target":
                    this.resolveTarget(arg, argIndex, argValue);
                    arg = "";
                    break;
                case "postfix":
                    arg = this.file.format("${" + argValue + "}");
                    if (this.type !== ModuleType.html) {
                        arg = encodeString(value, arg);
                    }
                    break;
            }
            this.replace(sourceIndex, sourceIndex + source.length, arg);
            return "";
        });
    }
    /**
     * 解析 __macro(name)
     * @param source 相关的代码片段。
     * @param sourceIndex *source* 在源文件的起始位置。
     * @param expression 要执行的宏表达式。
     * @returns 返回表达式的返回值。
     */
    resolveMacro(source, sourceIndex, expression) {
        // 简单宏名称。
        if (/^[a-zA-Z\u4e00-\u9fa5_$][\w\u4e00-\u9fa5$]*$/.test(expression)) {
            return this.getDefined(expression);
        }
        // 复杂表达式。
        try {
            // FIXME: 存在特定脚本注入发布工具?
            return eval(expression.replace(/[a-zA-Z\u4e00-\u9fa5_$][\w\u4e00-\u9fa5$]*/g, name => JSON.stringify(this.getDefined(name))));
        }
        catch (e) {
            this.report(source, sourceIndex, "Cannot evaluate expression: '{expression}'. {error}", { expression, error: e }, false, e);
            return null;
        }
    }
    /**
     * 获取预定义的宏。
     * @param name 要获取的宏名称。
     * @return 返回宏对应的值。如果宏未定义则返回 @undefined。
     */
    getDefined(name) {
        let defines = this.options.define;
        if (!defines || !defines.hasOwnProperty(name))
            return undefined;
        let value = defines[name];
        if (typeof value === "function")
            value = value.call(defines, this.file);
        return value;
    }
}
exports.BuildModule = BuildModule;
/**
 * 获取指定文件对应的模块。
 * @param file 要处理的文件。
 * @param options 创建模块的配置。
 * @returns 返回模块对象。
 */
function getModule(file, options) {
    // 不重复解析模块。
    if (file.webModule)
        return file.webModule;
    // 获取针对当前文件的配置。
    options = options || {};
    // 如果当前配置被禁用，则不解析。
    if (options.test && options.test(file) === false) {
        return file.webModule = new (require("./resource").ResourceModule)(file, options);
    }
    // 确定最终适合当前模块的配置。
    let actualOptions = options;
    for (let key in options.module) {
        if (options.module[key].test ? options.module[key].test(file) : file.match(key)) {
            if (actualOptions === options) {
                copyOptions(actualOptions = {}, options);
            }
            copyOptions(actualOptions, options.module[key]);
        }
    }
    // 确定模块类型。
    let moduleClass = actualOptions.type;
    if (typeof moduleClass !== "function") {
        switch (moduleClass != null ? ModuleType[moduleClass] : (exports.types[file.extension.toLowerCase()] || exports.types["*"])) {
            case ModuleType.js:
                moduleClass = require("./js").JsModule;
                break;
            case ModuleType.css:
                moduleClass = require("./css").CssModule;
                break;
            case ModuleType.html:
                moduleClass = require("./html").HtmlModule;
                break;
            case ModuleType.json:
                moduleClass = require("./resource").JsonResourceModule;
                break;
            case ModuleType.text:
                moduleClass = require("./resource").TextResourceModule;
                break;
            case ModuleType.binary:
                moduleClass = require("./resource").BinaryResourceModule;
                break;
            default:
                moduleClass = require("./resource").ResourceModule;
                break;
        }
    }
    // 新建模块。
    let module = file.webModule = new moduleClass(file, actualOptions);
    module.load();
    return module;
}
exports.getModule = getModule;
/**
 * 表示模块类型。
 */
var ModuleType;
(function (ModuleType) {
    /**
     * 资源模块。
     */
    ModuleType[ModuleType["resource"] = 0] = "resource";
    /**
     * 二进制模块。
     */
    ModuleType[ModuleType["binary"] = 1] = "binary";
    /**
     * 文本模块。
     */
    ModuleType[ModuleType["text"] = 2] = "text";
    /**
     * JavaScript 模块。
     */
    ModuleType[ModuleType["js"] = 3] = "js";
    /**
     * JSON 模块。
     */
    ModuleType[ModuleType["json"] = 4] = "json";
    /**
     * CSS 模块。
     */
    ModuleType[ModuleType["css"] = 5] = "css";
    /**
     * HTML 模块。
     */
    ModuleType[ModuleType["html"] = 6] = "html";
})(ModuleType = exports.ModuleType || (exports.ModuleType = {}));
/**
 * 默认模块类型映射表。
 */
exports.types = {
    ".html": ModuleType.html,
    ".htm": ModuleType.html,
    ".inc": ModuleType.html,
    ".shtm": ModuleType.html,
    ".shtml": ModuleType.html,
    ".jsp": ModuleType.html,
    ".asp": ModuleType.html,
    ".php": ModuleType.html,
    ".aspx": ModuleType.html,
    ".tpl": ModuleType.html,
    ".template": ModuleType.html,
    ".xml": ModuleType.text,
    ".cshtml": ModuleType.text,
    ".vbhtml": ModuleType.text,
    ".js": ModuleType.js,
    ".json": ModuleType.json,
    ".map": ModuleType.json,
    ".css": ModuleType.css,
    ".txt": ModuleType.text,
    ".text": ModuleType.text,
    ".md": ModuleType.text,
    ".log": ModuleType.text,
    "*": ModuleType.resource
};
/**
 * 从指定的配置复制到目标对象。
 * @param dest 复制的目标对象。
 * @param src 复制的源对象。
 */
function copyOptions(dest, src) {
    for (let key in src) {
        let value = src[key];
        // 对象则合并。
        if (value && typeof value === "object" && !Array.isArray(value)) {
            let c = dest[key];
            if (c !== false) {
                dest[key] = copyOptions(c && typeof c === "object" ? c : {}, value);
            }
            continue;
        }
        // 非对象复制。
        dest[key] = value;
    }
    return dest;
}
// #endregion
// #region 全局模块
/**
 * 存储内置模块名称映射。
 */
var nativeModules;
/**
 * 获取指定名称对应的内置模块路径。
 * @param name 要获取的内置模块名。
 * @return 如果模块不存在则返回 undefined；如果模块存在但无法模拟，则返回 null；否则返回模拟使用的模块路径。
 */
function getNativeModulePath(name) {
    if (!nativeModules) {
        try {
            nativeModules = require("node-libs-browser");
            nativeModules["__proto__"] = null;
        }
        catch (e) {
            nativeModules = { __proto__: null };
        }
    }
    return nativeModules[name];
}
// #endregion
// #region 解析公用
/**
 * 表示模块生成类型。
 */
var ModuleTarget;
(function (ModuleTarget) {
    /**
     * NodeJs 模块。
     */
    ModuleTarget[ModuleTarget["nodejs"] = 0] = "nodejs";
    /**
     * 浏览器。
     */
    ModuleTarget[ModuleTarget["browser"] = 1] = "browser";
    /**
     * TPack CMD 模块。
     */
    ModuleTarget[ModuleTarget["tpack"] = 2] = "tpack";
    /**
     * Requirejs AMD 模块。
     */
    ModuleTarget[ModuleTarget["requirejs"] = 3] = "requirejs";
})(ModuleTarget = exports.ModuleTarget || (exports.ModuleTarget = {}));
/**
 * 表示地址的使用场景。
 */
var UrlUsage;
(function (UrlUsage) {
    /**
     * 表示代码中的内联地址，可以指向一个本地文件或网络文件。
     */
    UrlUsage[UrlUsage["inline"] = 0] = "inline";
    /**
     * 表示一个本地文件。
     */
    UrlUsage[UrlUsage["local"] = 1] = "local";
    /**
     * 表示一个本地模块。
     */
    UrlUsage[UrlUsage["require"] = 2] = "require";
})(UrlUsage = exports.UrlUsage || (exports.UrlUsage = {}));
var processQueryCache;
/**
 * 处理地址中的查询字符串。
 * @param obj 地址对象。处理完成之后地址将更新。
 * @param name 参数名。
 * @returns 返回检索的值。如果参数为数字，则返回值，如果参数为 true/yes/on 则返回 -1。如果不存在参数则返回 null。
 */
function resolveQuery(obj, name) {
    if (obj.query) {
        if (!processQueryCache)
            processQueryCache = { __proto__: null };
        let re = processQueryCache[name] || (processQueryCache[name] = new RegExp("(\\?|&)" + name + "(=([^&]*))?(&|$)", "i"));
        let m = re.exec(obj.query);
        if (m) {
            obj.query = obj.query.replace(re, "$1").replace(/\?&?$/, "");
            let v = m[2];
            return !v || /^(true|yes|on)$/i.test(v) ? -1 : +v || 0;
        }
    }
    return null;
}
exports.resolveQuery = resolveQuery;
/**
 * 搜索 node_modules 下的模块路径。
 * @param dirPath 要搜索的文件夹路径。
 * @param modulesDirectory 要搜索的模块文件夹。
 * @param name 要搜索的文件名。
 * @param packageMains 要搜索的包主名。
 * @param extensions 要搜索的扩展名。
 * @returns 返回添加扩展名的路径。
 */
function tryPackage(dirPath, name, modulesDirectories, packageMains, extensions) {
    // dirPath: D:/work/
    // name: tpack/lib/builder
    // D:/work/node_modules/
    for (let i = 0; i < modulesDirectories.length; i++) {
        let p = Path.join(dirPath, modulesDirectories[i]);
        if (IO.existsDir(p)) {
            // D:/work/node_modules/tpack/lib/builder/
            p = Path.join(p, name);
            // D:/work/node_modules/tpack/lib/builder.js
            let r = tryExtensions(p, extensions);
            if (r)
                return r;
            // D:/work/node_modules/tpack/lib/builder/
            if (IO.existsDir(p)) {
                // D:/work/node_modules/tpack/lib/builder/package.json
                if (IO.existsFile(r = Path.join(p, "package.json"))) {
                    let packageObj;
                    try {
                        packageObj = require(r);
                    }
                    catch (e) { }
                    if (packageObj) {
                        for (let i = 0; i < packageMains.length; i++) {
                            let packageMain = packageMains[i];
                            if (typeof packageObj[packageMain] === "string" && IO.existsFile(r = Path.join(p, packageObj[packageMain]))) {
                                return r;
                            }
                        }
                    }
                }
                // D:/work/node_modules/tpack/lib/builder/sourceIndex.js
                for (let j = 0; j < extensions.length; j++) {
                    if (IO.existsFile(r = Path.join(p, "sourceIndex" + extensions[j]))) {
                        return r;
                    }
                }
            }
        }
    }
    // D:/
    let r = Path.dirname(dirPath);
    if (r.length !== dirPath.length) {
        return tryPackage(r, name, modulesDirectories, packageMains, extensions);
    }
    return null;
}
/**
 * 搜索追加扩展名的路径。
 * @param path 要搜索的路径。
 * @param extensions 要搜索的扩展名。
 * @returns 返回添加扩展名的路径。
 */
function tryExtensions(path, extensions) {
    for (let i = 0; i < extensions.length; i++) {
        let p = path + extensions[i];
        if (IO.existsFile(p)) {
            return p;
        }
    }
    return null;
}
/**
 * 解析指定路径的别名。
 * @param alias 所有别名列表。如 {"http://cdn.com/assets": "/assets"}
 * @param url 要匹配的地址。
 * @retrun 返回已转换的地址。
 */
function resolveAlias(alias, url) {
    let result;
    let applyAlias = "";
    let urlLower = url.toLowerCase();
    for (let key in alias) {
        let vp = key;
        if (vp.charCodeAt(vp.length - 1) === 47 /*/*/)
            vp = vp.substr(0, vp.length - 1);
        // 查找最长的匹配。
        if (vp.length < applyAlias.length)
            continue;
        // 匹配前缀。
        if ((url.length === vp.length || url.charCodeAt(vp.length) === 47 /*/*/) && urlLower.startsWith(vp.toLowerCase())) {
            let prefix = alias[key];
            if (prefix.charCodeAt(prefix.length - 1) === 47 /*/*/)
                prefix = prefix.substr(0, prefix.length - 1);
            applyAlias = vp;
            result = prefix + url.substr(vp.length);
        }
    }
    return result;
}
// #endregion
// #region 解析注释
/**
 * 获取当前预处理指令堆栈的值。
 */
var IfStackItem;
(function (IfStackItem) {
    /**
     * #if
     */
    IfStackItem[IfStackItem["if"] = 0] = "if";
    /**
     * #elif
     */
    IfStackItem[IfStackItem["elif"] = 1] = "elif";
    /**
     * #else
     */
    IfStackItem[IfStackItem["else"] = 2] = "else";
    /**
     * #region
     */
    IfStackItem[IfStackItem["region"] = 3] = "region";
})(IfStackItem = exports.IfStackItem || (exports.IfStackItem = {}));
/**
 * 解码一个字符串。
 * @param value 要解码的字符串。
 * @returns 返回处理后的字符串。
 */
function decodeString(value) {
    switch (value.charCodeAt(0)) {
        case 34 /*"*/:
            try {
                return JSON.parse(value);
            }
            catch (e) {
                return value.substr(1, value.length - 2);
            }
        case 39 /*'*/:
            try {
                return eval(value);
            }
            catch (e) {
                return value.substr(1, value.length - 2);
            }
        default:
            return value.trim();
    }
}
exports.decodeString = decodeString;
/**
 * 编码一个字符串。
 * @param value 要编码的字符串。
 * @param quote 使用的引号字符。
 * @returns 返回处理后的字符串。
 */
function encodeString(value, quote) {
    switch (quote.charCodeAt(0)) {
        case 34 /*"*/:
            return JSON.stringify(value);
        case 39 /*'*/:
            value = JSON.stringify(value);
            return "'" + value.substr(1, value.length - 2).replace(/'/g, '\\\'').replace(/\\"/g, '"') + "'";
        default:
            return value.indexOf(')') >= 0 ? JSON.stringify(value) : value;
    }
}
exports.encodeString = encodeString;
/**
 * 清除括号或引号。
 * @param value 要处理的字符串。
 * @returns 返回处理好的字符串。
 */
function trimQuotes(value) {
    // 提取引号内容。
    let m = /'(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*"/.exec(value);
    if (m)
        return decodeString(m[0]);
    // 提取括号内容。
    m = /\((.*)\)/.exec(value);
    if (m)
        return m[1];
    // 忽略前导等号。
    return value.replace(/^\s*=/, "").trim();
}
exports.trimQuotes = trimQuotes;
// #endregion
//# sourceMappingURL=module.js.map