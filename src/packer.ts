
import * as digo from "digo";
import { Module } from "./module";

/**
 * 表示一个模块打包器。
 */
export class Packer {

    modules: Module;

    /**
     * 创建指定文件对应的新模块。
     */
    createModule(file: digo.File) {
        const result = new Module();

        return result;
    }

    /**
     * 构建指定的模块。
     * @param module 要构建的模块。
     * @param done 构建完成的回调。
     */
    buildModule(module: Module, done: () => void) {

    }

}

