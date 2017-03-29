"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packer_1 = require("./packer");
exports.name = "WebPack";
function init(options, result) {
    const packer = new packer_1.Packer();
    result.prev.on("end", () => {
        packer.resolve();
    });
    return packer;
}
exports.init = init;
function add(file, options, done) {
    const module = options.createModule(file);
    options.buildModule(module, done);
}
exports.add = add;
//# sourceMappingURL=index.js.map