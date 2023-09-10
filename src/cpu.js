"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CPU = exports.OpCodes = void 0;
const ALU_js_1 = require("./ALU.js");
const components_js_1 = require("./components.js");
const support_js_1 = require("./support.js");
var OpCodes;
(function (OpCodes) {
    OpCodes[OpCodes["LDA"] = 0] = "LDA";
    OpCodes[OpCodes["LAA"] = 1] = "LAA";
    OpCodes[OpCodes["STA"] = 2] = "STA";
    OpCodes[OpCodes["LDB"] = 3] = "LDB";
    OpCodes[OpCodes["LAB"] = 4] = "LAB";
    OpCodes[OpCodes["STB"] = 5] = "STB";
    OpCodes[OpCodes["ADD"] = 6] = "ADD";
    OpCodes[OpCodes["ADC"] = 7] = "ADC";
    OpCodes[OpCodes["SUB"] = 8] = "SUB";
    OpCodes[OpCodes["SBC"] = 9] = "SBC";
    OpCodes[OpCodes["OPP"] = 10] = "OPP";
    OpCodes[OpCodes["JMP"] = 11] = "JMP";
    OpCodes[OpCodes["JMZ"] = 12] = "JMZ";
    OpCodes[OpCodes["NOP"] = 13] = "NOP"; // No-Operation
})(OpCodes || (exports.OpCodes = OpCodes = {}));
var MicroOps;
(function (MicroOps) {
    MicroOps[MicroOps["LD"] = 0] = "LD";
    MicroOps[MicroOps["ST"] = 1] = "ST";
    MicroOps[MicroOps["SA"] = 2] = "SA";
    MicroOps[MicroOps["SB"] = 3] = "SB";
    MicroOps[MicroOps["SW"] = 4] = "SW";
    MicroOps[MicroOps["PA"] = 5] = "PA";
    MicroOps[MicroOps["PB"] = 6] = "PB";
    MicroOps[MicroOps["AS"] = 7] = "AS";
    MicroOps[MicroOps["AL"] = 8] = "AL";
    MicroOps[MicroOps["AR"] = 9] = "AR";
    MicroOps[MicroOps["JP"] = 10] = "JP";
    MicroOps[MicroOps["JZ"] = 11] = "JZ"; // reads zero flag, and if set, jump
})(MicroOps || (MicroOps = {}));
var CpuState;
(function (CpuState) {
    CpuState[CpuState["Fetch1"] = 0] = "Fetch1";
    CpuState[CpuState["Fetch2"] = 1] = "Fetch2";
    CpuState[CpuState["Dexecute"] = 2] = "Dexecute"; // run commands based on opcode register
})(CpuState || (CpuState = {}));
// basic implementation for validation purposes only
class CPU extends components_js_1.Component {
    constructor(wordWidth) {
        super(wordWidth + 1, wordWidth + wordWidth + 2); // 1 added to input for clock // 2 added to output for memory RW and CS lines 
        this.cache = [];
        this.microOps = []; // stack of micro-operations
        this.opcode = OpCodes.NOP;
        this.state = CpuState.Fetch1;
        this.wordWidth = wordWidth;
        const addressSetArr = [];
        for (let i = 0; i < wordWidth; i++) {
            addressSetArr.push(i);
        }
        this.addressSet = new support_js_1.BitSet(addressSetArr);
        const dataSetIn = [];
        const dataSetOut = [];
        for (let i = 0; i < wordWidth; i++) {
            dataSetOut.push(wordWidth + i);
            dataSetIn.push(i);
        }
        this.outputDataSet = new support_js_1.BitSet(dataSetOut);
        this.inputDataSet = new support_js_1.BitSet(dataSetIn);
        this.memOpSet = new support_js_1.BitSet([wordWidth + wordWidth, wordWidth + wordWidth + 1]); // +0 -> RW, +1 -> CS
        this.clockSet = new support_js_1.BitSet([wordWidth]);
        this.alu = new ALU_js_1.ALU(wordWidth);
        this.pc = new support_js_1.Bits(wordWidth);
        this.A = new support_js_1.Bits(wordWidth);
        this.B = new support_js_1.Bits(wordWidth);
        this.setInterrupt(this.tick.bind(this), components_js_1.TriggerTypes.RisingEdge, new support_js_1.BitSet([0]), this.clockSet);
    }
    setClock(value) {
        this.setInputBit(0, value, this.clockSet);
    }
    tick() {
        switch (this.state) {
            case CpuState.Fetch1:
                this.setOutputBits(this.pc, this.addressSet);
                this.advancePC();
                this.setOutputBit(1, true, this.memOpSet); // ensure chip is selected
                this.setOutputBit(0, false, this.memOpSet); // ensure this is in read mode
                this.state = CpuState.Fetch2;
                break;
            case CpuState.Fetch2:
                this.cache.splice(0); // delete all
                this.opcode = this.getInputBits(this.inputDataSet).getDecimal();
                this.state = CpuState.Dexecute;
                this.loadOperation();
                break;
            case CpuState.Dexecute:
                if (this.microOps.length == 0) {
                    this.state = CpuState.Fetch1;
                }
                else {
                    this.doMicroOp(this.microOps[0]);
                    this.microOps.splice(0, 1); // get rid of first micro operation in list
                }
                break;
        }
    }
    advancePC() {
        this.pc.setDecimal(this.pc.getDecimal() + 1); // increment PC by 1
    }
    // microops assumed empty
    loadOperation() {
        switch (this.opcode) {
            case OpCodes.LDA: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this command reads where to read from
                this.microOps.push(MicroOps.SW); // send address to cache
                this.microOps.push(MicroOps.LD); // loads stored value
                this.microOps.push(MicroOps.SA); // pushes data into A register
                break;
            }
            case OpCodes.LAA: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this address reads value to push to A
                this.microOps.push(MicroOps.SA); // pushes data into A register
                break;
            }
            case OpCodes.STA: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this address reads where to store into
                this.microOps.push(MicroOps.SW); // store new address into cache
                this.microOps.push(MicroOps.PA); // push A onto data lines
                this.microOps.push(MicroOps.ST); // run store operation
                break;
            }
            case OpCodes.LDB: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this command reads where to read from
                this.microOps.push(MicroOps.SW); // send address to cache
                this.microOps.push(MicroOps.LD); // loads stored value
                this.microOps.push(MicroOps.SB); // pushes data into B register
                break;
            }
            case OpCodes.LAB: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this command reads what to push into B
                this.microOps.push(MicroOps.SB); // pushes data into A register
                break;
            }
            case OpCodes.STB: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this address reads where to store into
                this.microOps.push(MicroOps.SW); // store new address into cache
                this.microOps.push(MicroOps.PB); // push A onto data lines
                this.microOps.push(MicroOps.ST); // run store operation
                break;
            }
            case OpCodes.ADD: {
                const addCode = new support_js_1.Bits(5);
                addCode.setDecimal(ALU_js_1.ALUCodes.ADD);
                this.cache.push(addCode);
                this.microOps.push(MicroOps.AL); // load A and B into ALU
                this.microOps.push(MicroOps.AS); // set operation to data on cache
                this.microOps.push(MicroOps.AR); // lost final ALU data into A
                break;
            }
            case OpCodes.ADC: {
                const addCode = new support_js_1.Bits(5);
                addCode.setDecimal(ALU_js_1.ALUCodes.ADC);
                this.cache.push(addCode);
                this.microOps.push(MicroOps.AL); // load A and B into ALU
                this.microOps.push(MicroOps.AS); // set operation to data on cache
                this.microOps.push(MicroOps.AR); // lost final ALU data into A
                break;
            }
            case OpCodes.SUB: {
                const addCode = new support_js_1.Bits(5);
                addCode.setDecimal(ALU_js_1.ALUCodes.SUB);
                this.cache.push(addCode);
                this.microOps.push(MicroOps.AL); // load A and B into ALU
                this.microOps.push(MicroOps.AS); // set operation to data on cache
                this.microOps.push(MicroOps.AR); // lost final ALU data into A
                break;
            }
            case OpCodes.SBC: {
                const addCode = new support_js_1.Bits(5);
                addCode.setDecimal(ALU_js_1.ALUCodes.SBC);
                this.cache.push(addCode);
                this.microOps.push(MicroOps.AL); // load A and B into ALU
                this.microOps.push(MicroOps.AS); // set operation to data on cache
                this.microOps.push(MicroOps.AR); // push final ALU data into A
                break;
            }
            case OpCodes.OPP: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setDecimal(this.pc.getDecimal() + 1);
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // this address reads operation type
                this.microOps.push(MicroOps.SW); // push data lines into cache
                this.microOps.push(MicroOps.AL); // load A and B into ALU
                this.microOps.push(MicroOps.AS); // set operation to data from cache
                this.microOps.push(MicroOps.AR); // push final ALU data into A
                break;
            }
            case OpCodes.JMP: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // reads where to jump to
                this.microOps.push(MicroOps.SW); // push data lines into cache
                this.microOps.push(MicroOps.JP);
                break;
            }
            case OpCodes.JMZ: {
                const nextAddr = new support_js_1.Bits(this.wordWidth);
                nextAddr.setBits(this.pc);
                this.advancePC();
                this.cache.push(nextAddr);
                this.microOps.push(MicroOps.LD); // reads where to jump to
                this.microOps.push(MicroOps.SW); // push data lines into cache
                this.microOps.push(MicroOps.JZ);
                break;
            }
            case OpCodes.NOP:
            default:
                return;
        }
    }
    doMicroOp(op) {
        switch (op) {
            case MicroOps.LD: { // load from memory
                const address = (this.cache.length > 0) ? this.cache.pop() : new support_js_1.Bits(this.wordWidth);
                this.setOutputBits(address, this.addressSet);
                this.setOutputBit(1, true, this.memOpSet); // ensure chip is selected
                this.setOutputBit(0, false, this.memOpSet); // ensure this is in read mode
                break;
            }
            case MicroOps.ST: { // store whatever is on data pins into memory
                const address = (this.cache.length > 0) ? this.cache.pop() : new support_js_1.Bits(this.wordWidth);
                this.setOutputBits(address, this.addressSet);
                this.setOutputBit(1, true, this.memOpSet); // ensure chip is selected
                this.setOutputBit(0, true, this.memOpSet); // ensure this is in write mode
                break;
            }
            case MicroOps.SW: // store into working-memory
                this.cache.push(this.getInputBits(this.inputDataSet));
                break;
            case MicroOps.SA: // store into A
                this.A.setBits(this.getInputBits(this.inputDataSet));
                break;
            case MicroOps.SB: // store into B
                this.B.setBits(this.getInputBits(this.inputDataSet));
                break;
            case MicroOps.PA: // push from A
                this.setOutputBits(this.A, this.outputDataSet);
                break;
            case MicroOps.PB: // push from B
                this.setOutputBits(this.B, this.outputDataSet);
                break;
            case MicroOps.AS: { // set ALU mode, and make ALU do operation
                const operation = (this.cache.length > 0) ? this.cache.pop() : new support_js_1.Bits(this.wordWidth);
                this.alu.setOperation(operation);
                this.alu.setDoOperation(true);
                break;
            }
            case MicroOps.AL: // load A and B into ALU
                this.alu.setAInput(this.A);
                this.alu.setBInput(this.B);
                break;
            case MicroOps.AR: // set output of ALU into A
                this.A.setBits(this.alu.getOutputBits());
                break;
            case MicroOps.JP: { // jumps to location stored in cache
                const address = new support_js_1.Bits(this.wordWidth); // default value of 0
                if (this.cache.length > 0)
                    address.setDecimal(this.cache.pop().getDecimal()); // subtract 1 from value, because value automatically incremented by 1 before execution
                this.pc.setBits(address); // jump to address
                break;
            }
            case MicroOps.JZ: {
                const address = (this.cache.length > 0) ? this.cache.pop() : new support_js_1.Bits(this.wordWidth); // default value of 0
                if (this.alu.getFlag("Z")) {
                    this.pc.setBits(address);
                }
                break;
            }
        }
    }
}
exports.CPU = CPU;
//# sourceMappingURL=cpu.js.map