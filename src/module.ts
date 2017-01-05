/**
 * @file 模块
 * @author xuld <xuld@vip.qq.com>
 */
import * as digo from "digo";

/**
 * 表示一个模块。
 */
export class Module {

    /**
     * 获取当前模块的源文件。
     */
    file: digo.File;

    content: string;

    /**
     * 获取当前模块的替换列表。
     */
    replacements: Replacement[] = [];

    /**
     * 插入一个替换记录。
     * @param replacement 要插入的替换记录。
     * @return 返回插入的位置，如果插入失败则返回 -1。
     */
    addReplacement(replacement: Replacement) {

        console.assert(replacement.startIndex <= replacement.endIndex);
        console.assert(replacement.endIndex <= this.source.length);

        // 如果最新替换记录在最末尾，则快速插入。
        if (replacement.startIndex >= this._lastReplacementEndIndex) {
            this._lastReplacementEndIndex = replacement.endIndex;
            return this.replacements.push(replacement);
        }

        // 根据排序规则查找插入点。
        let p = this.replacements.length;
        while (p) {
            let r = this.replacements[p - 1];
            if (replacement.startIndex >= r.startIndex) {
                // 无法插入到上一个替换点中间：忽略当前更新操作。
                if (replacement.startIndex < r.endIndex || (p < this.replacements.length && replacement.endIndex > this.replacements[p].startIndex)) {
                    return -1;
                }
                break;
            }
            p--;
        }

        // 插入到指定位置。
        this._lastReplacementEndIndex = replacement.endIndex;
        this.replacements.splice(p, 0, replacement);
        return p;
    }


}

// #region 替换

/**
 * 表示一个替换记录。
 */
export abstract class Replacement {

    /**
     * 获取当前替换记录在原始内容的起始位置。
     */
    startIndex: number;

    /**
     * 获取当前替换记录在原始内容的结束位置（不包括结束位置）。
     */
    endIndex: number;

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: typeof TextReplacement.prototype.data | typeof ModuleReplacement.prototype.data | typeof TextDelayReplacement.prototype.data;

    /**
     * 初始化新的替换项。
     * @param startIndex 原始内容的起始位置。
     * @param endIndex 原始内容的结束位置（不包括结束位置）。
     * @param data 替换的数据。数据意义根据类型决定。
     */
    constructor(startIndex: number, endIndex: number, data: typeof Replacement.prototype.data) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.data = data;
    }

}

/**
 * 表示一个文本替换记录。
 */
export class TextReplacement extends Replacement {

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: string;

}

/**
 * 表示一个文本替换记录。
 */
export class ModuleReplacement extends Replacement {

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: Module;

}

/**
 * 表示一个文本替换记录。
 */
export class TextDelayReplacement extends Replacement {

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: (module: Module) => string;

}

// #endregion
