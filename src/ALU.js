"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALU = exports.LogicUnit = exports.ALUCodes = exports.LogicUnitCodes = void 0;
const components_js_1 = require("./components.js");
const support_js_1 = require("./support.js");
const MAX_LU_CODE = 16;
var LogicUnitCodes;
(function (LogicUnitCodes) {
    LogicUnitCodes[LogicUnitCodes["AND"] = 0] = "AND";
    LogicUnitCodes[LogicUnitCodes["OR"] = 1] = "OR";
    LogicUnitCodes[LogicUnitCodes["XOR"] = 2] = "XOR";
    LogicUnitCodes[LogicUnitCodes["NAND"] = 3] = "NAND";
    LogicUnitCodes[LogicUnitCodes["NOR"] = 4] = "NOR";
    LogicUnitCodes[LogicUnitCodes["XNOR"] = 5] = "XNOR";
    LogicUnitCodes[LogicUnitCodes["NOTA"] = 6] = "NOTA";
    LogicUnitCodes[LogicUnitCodes["NOTB"] = 7] = "NOTB";
    // shifts A by B units
    LogicUnitCodes[LogicUnitCodes["SHIFTL"] = 8] = "SHIFTL";
    LogicUnitCodes[LogicUnitCodes["SHIFTR"] = 9] = "SHIFTR";
    // rolls A by B units
    LogicUnitCodes[LogicUnitCodes["ROL"] = 10] = "ROL";
    LogicUnitCodes[LogicUnitCodes["ROR"] = 11] = "ROR";
})(LogicUnitCodes || (exports.LogicUnitCodes = LogicUnitCodes = {}));
;
var ALUCodes;
(function (ALUCodes) {
    ALUCodes[ALUCodes["ADD"] = 16] = "ADD";
    ALUCodes[ALUCodes["ADC"] = 17] = "ADC";
    ALUCodes[ALUCodes["SUB"] = 18] = "SUB";
    ALUCodes[ALUCodes["SBC"] = 19] = "SBC";
    ALUCodes[ALUCodes["MUL"] = 20] = "MUL";
    ALUCodes[ALUCodes["DIV"] = 21] = "DIV";
    ALUCodes[ALUCodes["MOD"] = 22] = "MOD";
    ALUCodes[ALUCodes["POW"] = 23] = "POW";
    ALUCodes[ALUCodes["XROOT"] = 24] = "XROOT";
})(ALUCodes || (exports.ALUCodes = ALUCodes = {}));
;
class LogicUnit extends components_js_1.Component {
    constructor(wordWidth, controlBits = 4) {
        super(wordWidth * 2 + controlBits + 1, wordWidth); // 4 bits required to capture all 16 combinations possible with two inputs; 5th bit required for doOperation
        this.controlBits = controlBits;
        const inputAArr = [];
        const inputBArr = [];
        for (let i = 0; i < wordWidth; i++) {
            inputAArr.push(i);
            inputBArr.push(wordWidth + i);
        }
        this.inputASet = new support_js_1.BitSet(inputAArr);
        this.inputBSet = new support_js_1.BitSet(inputBArr);
        const typeSelectedArr = [];
        for (let i = 0; i < this.controlBits; i++) {
            typeSelectedArr.push(wordWidth * 2 + i);
        }
        this.typeSelectSet = new support_js_1.BitSet(typeSelectedArr);
        this.doOperationSet = new support_js_1.BitSet([wordWidth * 2 + controlBits]);
        this.setInterrupt(this.doOperation.bind(this), components_js_1.TriggerTypes.SetTrue, new support_js_1.BitSet([0]), this.doOperationSet);
    }
    setDoOperation(value) {
        this.setInputBit(0, value, this.doOperationSet);
    }
    setOperation(bits, bitSet) {
        this.setInputBits(bits, this.typeSelectSet.combine(bitSet));
    }
    setAInput(bits, bitSet) {
        this.setInputBits(bits, this.inputASet.combine(bitSet));
    }
    setBInput(bits, bitSet) {
        this.setInputBits(bits, this.inputBSet.combine(bitSet));
    }
    connectAInputFrom(other, fromBitSet, toBitSet) {
        other.connectTo(this, fromBitSet, this.inputASet.combine(toBitSet));
    }
    connectBInputFrom(other, fromBitSet, toBitSet) {
        other.connectTo(this, fromBitSet, this.inputBSet.combine(toBitSet));
    }
    doOperation() {
        const inputA = this.getInputBits(this.inputASet);
        const inputB = this.getInputBits(this.inputBSet);
        const operation = this.getInputBits(this.typeSelectSet).getDecimal();
        let output;
        switch (operation) {
            case LogicUnitCodes.AND:
                output = inputA.and(inputB);
                break;
            case LogicUnitCodes.OR:
                output = inputA.or(inputB);
                break;
            case LogicUnitCodes.XOR:
                output = inputA.xor(inputB);
                break;
            case LogicUnitCodes.NAND:
                output = inputA.and(inputB).not();
                break;
            case LogicUnitCodes.NOR:
                output = inputA.or(inputB).not();
                break;
            case LogicUnitCodes.XNOR:
                output = inputA.xor(inputB).not();
                break;
            case LogicUnitCodes.NOTA:
                output = inputA.not();
                break;
            case LogicUnitCodes.NOTB:
                output = inputB.not();
                break;
            case LogicUnitCodes.ROL:
                output = inputA.rotate(-inputB.getDecimal());
                break;
            case LogicUnitCodes.ROR:
                output = inputA.rotate(inputB.getDecimal());
                break;
            case LogicUnitCodes.SHIFTL:
                output = inputA.shift(-inputB.getDecimal());
                break;
            case LogicUnitCodes.SHIFTR:
                output = inputA.shift(inputB.getDecimal());
                break;
            default: // didn't match--don't do anything
                return;
        }
        this.output.setBits(output);
    }
}
exports.LogicUnit = LogicUnit;
// flags:
// (O) overflow
// (U) underflow
// (C) carry
// (Z) zero
// (D) divide-by-zero
class ALU extends LogicUnit {
    constructor(wordWidth) {
        super(wordWidth, 5); // 5 bits to cover everything the ALU can do (16 dedicated to LU portion)
        this.flags = new support_js_1.Flags(["O", "U", "C", "Z", "D"]);
    }
    doOperation() {
        const operation = this.getInputBits(this.typeSelectSet).getDecimal();
        let isCarrySet = this.flags.getFlag("C");
        this.flags.clear(); // reset all flags
        let output;
        // let standard Logic Unit handle this
        if (operation < MAX_LU_CODE) {
            console.log(ALUCodes);
            super.doOperation();
            output = this.getOutputBits();
        }
        else {
            // arithmetic involved
            const width = this.inputASet.getWidth();
            const inputA = this.getInputBits(this.inputASet).getDecimal();
            const inputB = this.getInputBits(this.inputBSet).getDecimal();
            output = new support_js_1.Bits(width);
            switch (operation) {
                case ALUCodes.ADD: {
                    const sum = inputA + inputB;
                    output.setDecimal(sum);
                    if (output.getDecimal() != sum) {
                        this.flags.setFlag("O", true); // overflow occurred
                        this.flags.setFlag("C", true);
                    }
                    break;
                }
                case ALUCodes.ADC: {
                    const sum = inputA + inputB + (isCarrySet ? 1 : 0);
                    output.setDecimal(sum);
                    if (output.getDecimal() != sum) {
                        this.flags.setFlag("O", true); // overflow occurred
                        this.flags.setFlag("C", true);
                    }
                    break;
                }
                case ALUCodes.SUB: {
                    const difference = inputA - inputB;
                    output.setDecimal(difference);
                    if (output.getDecimal() != difference) {
                        this.flags.setFlag("U", true); // underflow
                        this.flags.setFlag("C", true);
                    }
                    break;
                }
                case ALUCodes.SBC: {
                    const difference = inputA - inputB - (isCarrySet ? 1 : 0);
                    output.setDecimal(difference);
                    if (output.getDecimal() != difference) {
                        this.flags.setFlag("U", true); // underflow
                        this.flags.setFlag("C", true);
                    }
                    break;
                }
                case ALUCodes.MUL:
                    const product = inputA * inputB;
                    output.setDecimal(product);
                    if (output.getDecimal() != product)
                        this.flags.setFlag("O", true); // overflow
                    break;
                case ALUCodes.DIV:
                    if (inputB == 0)
                        this.flags.setFlag("D", true); // leave output at default value of 0, set divide-by-zero flag
                    else {
                        const quotient = Math.floor(inputA / inputB); // unpossible for this to be overflow/underflow
                        output.setDecimal(quotient);
                    }
                    break;
                case ALUCodes.MOD:
                    if (inputB == 0)
                        this.flags.setFlag("D", true); // leave output at default value of 0, set divide-by-zero flag
                    else {
                        const remainder = inputA % inputB; // unpossible for this to be overflow/underflow
                        output.setDecimal(remainder);
                    }
                    break;
                case ALUCodes.POW:
                    if (inputA == 0 && inputB == 0) {
                        this.flags.setFlag("D", true); // 0^0 undefined, treat this as dividing by zero, but also set output value to 1 (this value determined by JS and HP48)
                        output.setDecimal(1);
                    }
                    else {
                        const exp = Math.pow(inputA, inputB);
                        output.setDecimal(exp);
                        if (output.getDecimal() != exp)
                            this.flags.setFlag("O", true); // overflow
                    }
                    break;
                case ALUCodes.XROOT:
                    if (inputA == 0 && inputB == 0) {
                        this.flags.setFlag("D", true); // 0^0 undefined, treat this as dividing by zero, but also set output value to 1 (this value determined by JS and HP48)
                        output.setDecimal(1);
                    }
                    else {
                        const exp = Math.pow(inputA, -inputB);
                        output.setDecimal(exp); // underflow unpossible in this scenario
                    }
                    break;
                default:
                    return; // do nothing
            }
            this.setOutputBits(output);
        }
        if (output.getDecimal() == 0)
            this.flags.setFlag("Z", true); // set zero flag
    }
    getFlag(name) {
        return this.flags.getFlag(name);
    }
    setFlag(name, value) {
        this.flags.setFlag(name, value);
    }
    getRawFlags() { return this.flags.getRawFlags(); }
}
exports.ALU = ALU;
//# sourceMappingURL=ALU.js.map