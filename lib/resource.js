"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = require("./module");
/**
 * 表示一个资源模块。
 */
class ResourceModule extends module_1.BuildModule {
    /**
     * 获取当前模块在模块化之前的源文件。
     */
    get source() { return this.file; }
    /**
     * 当被子类重写时，负责解析当前模块。
     */
    parse() { }
    /**
     * 将模块信息保存到源文件。
     */
    save() { }
}
exports.ResourceModule = ResourceModule;
/**
 * 表示一个文本资源模块。
 */
class TextResourceModule extends ResourceModule {
    /**
     * 获取当前模块的类型。
     */
    get type() { return module_1.ModuleType.text; }
}
exports.TextResourceModule = TextResourceModule;
/**
 * 表示一个二进制资源模块。
 */
class BinaryResourceModule extends ResourceModule {
    /**
     * 获取当前模块的类型。
     */
    get type() { return module_1.ModuleType.binary; }
}
exports.BinaryResourceModule = BinaryResourceModule;
/**
 * 表示一个 JSON 资源模块。
 */
class JsonResourceModule extends ResourceModule {
    /**
     * 获取当前模块的类型。
     */
    get type() { return module_1.ModuleType.json; }
}
exports.JsonResourceModule = JsonResourceModule;
//# sourceMappingURL=resource.js.map