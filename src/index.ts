/**
 * @file digo 插件：解析 Web 模块依赖及打包
 * @author xuld <xuld@vip.qq.com>
 */
import * as digo from "digo";
import { Packer } from "./packer";

export const name = "WebPack";

export function init(options: (list: digo.FileList, packer: Packer) => void, result: digo.FileList) {
    const packer = new Packer();
    result.prev.on("end", () => {
        packer.resolve();
    });
    return packer;
}

export function add(file: digo.File, options: Packer, done: () => void) {
    const module = options.createModule(file);
    options.buildModule(module, done);
}
