"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = require("./module");
/**
 * 表示一个模块打包器。
 */
class Packer {
    /**
     * 创建指定文件对应的新模块。
     */
    createModule(file) {
        const result = new module_1.Module();
        return result;
    }
    /**
     * 构建指定的模块。
     * @param module 要构建的模块。
     * @param done 构建完成的回调。
     */
    buildModule(module, done) {
    }
}
exports.Packer = Packer;
//# sourceMappingURL=packer.js.map