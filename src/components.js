"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputSelector = exports.OutputSelector = exports.RAM = exports.Component = exports.TriggerTypes = void 0;
const support_js_1 = require("./support.js");
var TriggerTypes;
(function (TriggerTypes) {
    TriggerTypes[TriggerTypes["FallingEdge"] = 0] = "FallingEdge";
    TriggerTypes[TriggerTypes["RisingEdge"] = 1] = "RisingEdge";
    TriggerTypes[TriggerTypes["RisingFallingEdge"] = 2] = "RisingFallingEdge";
    TriggerTypes[TriggerTypes["Set"] = 3] = "Set";
    TriggerTypes[TriggerTypes["SetTrue"] = 4] = "SetTrue";
    TriggerTypes[TriggerTypes["SetFalse"] = 5] = "SetFalse"; // whenever value is set to false (even if no change) -> trigger
})(TriggerTypes || (exports.TriggerTypes = TriggerTypes = {}));
;
class Component {
    constructor(inputWidth, outputWidth) {
        this.input = new support_js_1.Interface(inputWidth);
        this.output = new support_js_1.Interface(outputWidth);
    }
    setInputBit(bit, value, bitSet) {
        this.input.setBit(bit, value, bitSet);
    }
    setInputBits(bits, bitSet) {
        this.input.setBits(bits, bitSet);
    }
    getOutputBit(bit, bitSet) {
        return this.output.readBit(bit, bitSet);
    }
    getOutputBits(bitSet) {
        return this.output.readBits(bitSet);
    }
    connectTo(other, fromBitSet, toBitSet) {
        this.output.onSet((bit, value) => {
            // if (bit == -1) {
            //   other.setInputBits(this.getInputBits(fromBitSet), toBitSet);
            // }
            if (!fromBitSet.isActive(bit))
                return; // this bit not present in fromBitSet, ignore
            else {
                bit = fromBitSet.getIndexOfPairedBit(bit); // get index from [fromBitSet]
                other.setInputBit(bit, value, toBitSet);
            }
        });
    }
    // the following are only for internal use WITHIN subclasses
    getInputBit(bit, bitSet) {
        return this.input.readBit(bit, bitSet);
    }
    getInputBits(bitSet) {
        return this.input.readBits(bitSet);
    }
    setOutputBit(bit, value, bitSet) {
        this.output.setBit(bit, value, bitSet);
    }
    setOutputBits(bits, bitSet) {
        this.output.setBits(bits, bitSet);
    }
    setInterrupt(callback, triggerType, bits, bitSet) {
        bits = bitSet.combine(bits);
        if (bits.getWidth() == 0)
            return; // invalid bit will never be changed
        switch (triggerType) {
            case TriggerTypes.FallingEdge:
                this.input.onChange((l_bit, l_value) => { if (bits.isActive(l_bit) && !l_value) {
                    callback(l_bit, l_value);
                } });
                break;
            case TriggerTypes.RisingEdge:
                this.input.onChange((l_bit, l_value) => { if (bits.isActive(l_bit) && l_value) {
                    callback(l_bit, l_value);
                } });
                break;
            case TriggerTypes.RisingFallingEdge:
                this.input.onChange((l_bit, l_value) => { if (bits.isActive(l_bit)) {
                    callback(l_bit, l_value);
                } });
                break;
            case TriggerTypes.Set:
                this.input.onSet((l_bit, l_value) => { if (!l_value)
                    callback(l_bit, l_value); });
                break;
            case TriggerTypes.SetFalse:
                this.input.onSet((l_bit, l_value) => { if (bits.isActive(l_bit) && !l_value)
                    callback(l_bit, l_value); });
                break;
            case TriggerTypes.SetTrue:
                this.input.onSet((l_bit, l_value) => { if (bits.isActive(l_bit) && l_value)
                    callback(l_bit, l_value); });
                break;
        }
    }
}
exports.Component = Component;
class RAM extends Component {
    constructor(addressBits, wordSize) {
        const totalPins = addressBits + wordSize + 1; // +1 adds in: R/W signal;
        super(totalPins, wordSize);
        this.memory = [];
        this.isEnabled = false;
        // this.memory = new Bits(2 ** totalBits); // this grows exponentially... might want to make a new "FutureBits" class to dynamically grow size of bits
        const wordCount = Math.pow(2, addressBits); // this grows exponentially... might want to make a new "FutureBits" class to dynamically grow size of bits
        for (let i = 0; i < wordCount; i++) {
            this.memory.push(new support_js_1.Bits(wordSize));
        }
        this.wordSize = wordSize;
        const addressPins = [];
        for (let i = 0; i < addressBits; i++) {
            addressPins.push(i);
        }
        this.memoryAddressSet = new support_js_1.BitSet(addressPins);
        const dataPins = [];
        for (let i = 0; i < wordSize; i++) {
            dataPins.push(addressBits + i);
        }
        this.memoryDataSet = new support_js_1.BitSet(dataPins);
        const controlPins = [addressBits + wordSize, addressBits + wordSize + 1]; // [Read/Write, Enable]
        this.memoryControlSet = new support_js_1.BitSet(controlPins);
        this.setInterrupt(this.performWrite.bind(this), TriggerTypes.SetTrue, new support_js_1.BitSet([0]), this.memoryControlSet);
        this.setInterrupt(this.performRead.bind(this), TriggerTypes.SetFalse, new support_js_1.BitSet([0]), this.memoryControlSet);
        this.setInterrupt(this.changeEnableState.bind(this), TriggerTypes.Set, new support_js_1.BitSet([0, 1]), this.memoryControlSet);
    }
    setAddress(bits, bitSet) {
        if (!this.isEnabled)
            return; // ignore everything if not enabled
        this.setInputBits(bits, this.memoryAddressSet.combine(bitSet));
    }
    setData(bits, bitSet) {
        if (!this.isEnabled)
            return; // ignore everything if not enabled
        this.setInputBits(bits, this.memoryDataSet.combine(bitSet));
    }
    getData(bitSet) {
        return this.getOutputBits(bitSet); // only output pins are data pins, therefore no extra set needed to be combined
    }
    // 0->(R)ead, 1->(W)rite
    setRW(bit) {
        if (!this.isEnabled)
            return; // ignore everything if not enabled
        this.setInputBit(0, bit, this.memoryControlSet);
    }
    // 0->disabled, 1->enabled
    setEN(bit) {
        if (!this.isEnabled)
            return; // ignore everything if not enabled
        this.setInputBit(1, bit, this.memoryControlSet);
    }
    // used for initial setup
    setWord(bits, address) {
        if (address >= this.memory.length)
            return; // invalid address
        if (typeof bits == "number")
            this.memory[address].setDecimal(bits);
        else
            this.memory[address].setBits(bits);
    }
    setWords(bits, offsetAddress) {
        for (let i = 0; i < bits.length; i++) {
            this.setWord(bits[i], offsetAddress + i);
        }
    }
    getWord(address) {
        if (address >= this.memory.length)
            return null; // invalid address
        return this.memory[address].copy();
    }
    getWords() {
        return this.memory;
    }
    performWrite() {
        const numericAddress = this.getInputBits(this.memoryAddressSet).getDecimal();
        const value = this.getInputBits(this.memoryDataSet);
        this.memory[numericAddress].setBits(value);
    }
    performRead() {
        const numericAddress = this.getInputBits(this.memoryAddressSet).getDecimal();
        this.setOutputBits(this.memory[numericAddress]); // no BitSet needed, because the only output pins are for data bits
    }
    changeEnableState(bit, value) {
        this.isEnabled = value;
    }
}
exports.RAM = RAM;
class OutputSelector extends Component {
    constructor(width, inputSelectorBits, outputCount) {
        super(width + inputSelectorBits, width * outputCount);
        this.outputSets = [];
        const selectorInputArr = []; // data input
        for (let i = 0; i < width; i++) {
            selectorInputArr.push(i);
        }
        this.selectorInputSet = new support_js_1.BitSet(selectorInputArr);
        const selectorBitSet = []; // selects output
        for (let i = 0; i < inputSelectorBits; i++) {
            selectorBitSet.push(width + i);
        }
        this.selectorBitSet = new support_js_1.BitSet(selectorBitSet);
        for (let i = 0; i < outputCount; i++) {
            let outputSetData = [];
            for (let j = 0; j < width; j++) {
                outputSetData.push(width * i + j);
            }
            this.outputSets.push(new support_js_1.BitSet(outputSetData));
        }
    }
    selectOutput(bits, bitSet) {
        this.setInputBits(bits, this.selectorBitSet.combine(bitSet));
    }
    setInput(bits, bitSet) {
        this.setInputBits(bits, this.selectorInputSet.combine(bitSet));
    }
    getOutput(outputIndex, bitSet) {
        if (outputIndex >= this.outputSets.length)
            return new support_js_1.Bits(0); // invalid
        return this.getOutputBits(this.outputSets[outputIndex].combine(bitSet));
    }
    connectOutputTo(other, outputId, fromBitSet, toBitSet) {
        if (outputId >= this.outputSets.length)
            return; // invalid output id
        super.connectTo(other, this.outputSets[outputId].combine(fromBitSet), toBitSet);
    }
}
exports.OutputSelector = OutputSelector;
class InputSelector extends Component {
    constructor(width, inputSelectorBits, inputCount) {
        super(width + inputSelectorBits * inputCount, width);
        this.selectorInputSets = [];
        const selectorOutputArr = []; // data input
        for (let i = 0; i < width; i++) {
            selectorOutputArr.push(i);
        }
        this.outputSet = new support_js_1.BitSet(selectorOutputArr);
        for (let i = 0; i < inputCount; i++) {
            let inputSetData = [];
            for (let j = 0; j < width; j++) {
                inputSetData.push(width * i + j);
            }
            this.selectorInputSets.push(new support_js_1.BitSet(inputSetData));
        }
        const start = inputCount * width;
        const selectorBitSet = []; // selects output
        for (let i = 0; i < inputSelectorBits; i++) {
            selectorBitSet.push(start + i);
        }
        this.selectorBitSet = new support_js_1.BitSet(selectorBitSet);
    }
    selectOutput(bits, bitSet) {
        this.setInputBits(bits, this.selectorBitSet.combine(bitSet));
    }
    setInput(bits, inputId, bitSet) {
        if (inputId >= this.selectorInputSets.length)
            return; // invalid
        this.setInputBits(bits, this.selectorInputSets[inputId].combine(bitSet));
    }
    connectInputFrom(other, inputId, fromBitSet, toBitSet) {
        if (inputId >= this.selectorInputSets.length)
            return; // invalid inputId
        other.connectTo(this, fromBitSet, this.selectorInputSets[inputId].combine(toBitSet));
    }
}
exports.InputSelector = InputSelector;
//# sourceMappingURL=components.js.map