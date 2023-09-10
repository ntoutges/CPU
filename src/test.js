"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.test = void 0;
const components_js_1 = require("./components.js");
const cpu_js_1 = require("./cpu.js");
const support_js_1 = require("./support.js");
function test() {
    const cpu = new cpu_js_1.CPU(8);
    const ram = new components_js_1.RAM(8, 8);
    cpu.connectTo(ram, cpu.addressSet, ram.memoryAddressSet);
    cpu.connectTo(ram, cpu.memOpSet, ram.memoryControlSet);
    cpu.connectTo(ram, cpu.outputDataSet, ram.memoryDataSet);
    ram.connectTo(cpu, new support_js_1.AllBitSet(), cpu.inputDataSet);
    ram.setWords([
        cpu_js_1.OpCodes.LDA, 10,
        cpu_js_1.OpCodes.LDB, 11,
        cpu_js_1.OpCodes.ADD,
        cpu_js_1.OpCodes.STA, 255,
        cpu_js_1.OpCodes.JMP, 7,
        0,
        20, 40
    ], 0);
    ram.setEN(true);
    const ad = new support_js_1.Bits(4);
    ad.setDecimal(1);
    ram.setAddress(ad);
    // cpu.setClock(true)
    for (let i = 0; i < 100; i++) {
        cpu.setClock(i % 2 == 0);
    }
    console.log(ram.getWord(255).getDecimal());
}
exports.test = test;
//# sourceMappingURL=test.js.map