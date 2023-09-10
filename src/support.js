"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Flags = exports.Bus = exports.Interface = exports.AllBitSet = exports.BitSet = exports.Bits = void 0;
class Bits {
    constructor(width) {
        this.data = [];
        for (let i = 0; i < width; i++) {
            this.data.push(false);
        } // default value
    }
    setBit(bit, value, bitSet = allBitSet) {
        const setBit = bitSet.getPairedActiveBit(bit);
        if (setBit == -1)
            return false; // invalid bit
        if (setBit >= this.data.length)
            return false; // unpossible to set bit outside range
        const isChange = this.data[setBit] != value;
        this.data[setBit] = value;
        return isChange;
    }
    getBit(bit, bitSet = allBitSet) {
        const setBit = bitSet.getPairedActiveBit(bit);
        if (setBit >= this.data.length)
            return false; // invalid
        return this.data[setBit]; // return value at index
    }
    get width() { return this.data.length; }
    setDecimal(value, bitSet = allBitSet) {
        const width = bitSet.getWidth(this.data.length);
        value = value % (Math.pow(2, width)); // constrain to within the length of this value
        if (value < 0)
            value += Math.pow(2, width); // negative value is shoved into the positive range
        let isChange = false;
        // convert decimal to binary
        for (let i = width - 1; i >= 0; i--) {
            const placeValue = Math.pow(2, i);
            if (value >= placeValue) {
                this.setBit(i, true, bitSet);
                value -= placeValue;
                isChange = true;
            }
            else {
                this.setBit(i, false, bitSet);
                isChange = true;
            }
        }
        return isChange;
    }
    setBits(bits, bitSet = allBitSet) {
        const width = Math.min(bits.width, bitSet.getWidth(this.data.length)); // either of these can determine the minimum value
        let isChange = false;
        for (let i = 0; i < width; i++) {
            if (this.setBit(i, bits.getBit(i), bitSet))
                isChange = true;
        }
        return isChange;
    }
    getDecimal(bitSet = allBitSet) {
        const width = bitSet.getWidth(this.data.length);
        let val = 0;
        for (let i = 0; i < width; i++) {
            val += (Math.pow(2, i)) * (this.getBit(i, bitSet) ? 1 : 0);
        }
        return val;
    }
    copy(bitSet = allBitSet) {
        const width = bitSet.getWidth(this.data.length);
        const copy = new Bits(width);
        for (let i = 0; i < width; i++) {
            copy.setBit(i, this.getBit(bitSet.getPairedActiveBit(i)));
        }
        return copy;
    }
    toString(bitSet = allBitSet) {
        const width = bitSet.getWidth(this.data.length);
        let str = "";
        for (let i = 0; i < width; i++) {
            str = (this.data[bitSet.getPairedActiveBit(i)] ? "1" : "0") + str;
        }
        return `Bits[${str}]`;
    }
    and(other) {
        let newBits = new Bits(this.width);
        for (const i in this.data) {
            newBits.setBit(+i, this.data[i] && other.getBit(+i));
        }
        return newBits;
    }
    or(other) {
        let newBits = new Bits(this.width);
        for (const i in this.data) {
            newBits.setBit(+i, this.data[i] || other.getBit(+i));
        }
        return newBits;
    }
    xor(other) {
        let newBits = new Bits(this.width);
        for (const i in this.data) {
            newBits.setBit(+i, this.data[i] != other.getBit(+i));
        }
        return newBits;
    }
    not() {
        let newBits = new Bits(this.width);
        for (const i in this.data) {
            newBits.setBit(+i, !this.data[i]);
        }
        return newBits;
    }
    shift(amount) {
        if (amount == 0)
            return this.copy();
        const width = this.width;
        if (Math.abs(amount) >= width)
            return new Bits(this.width);
        if (amount > 0) {
            const newBits = new Bits(width);
            for (let newI = amount; newI < width; newI++) {
                const oldI = newI - amount;
                newBits.setBit(newI, this.data[oldI]);
            }
        }
        // amount < 0
        const newBits = new Bits(width);
        for (let oldI = amount; oldI < width; oldI++) {
            const newI = oldI - amount;
            newBits.setBit(newI, this.data[oldI]);
        }
    }
    rotate(amount) {
        if (amount == 0)
            return this.copy();
        const width = this.width;
        if (amount > 0) {
            const newBits = new Bits(width);
            for (let fromI = 0; fromI < width; fromI++) {
                const toI = (fromI + amount) % width;
                newBits.setBit(toI, this.data[fromI]);
            }
            return newBits;
        }
        // amount < 0
        const newBits = new Bits(width);
        for (let fromI = 0; fromI < width; fromI++) {
            const toI = (fromI + width - amount) % width;
            newBits.setBit(toI, this.data[fromI]);
        }
        return newBits;
    }
}
exports.Bits = Bits;
// bitmask determining which bits will be used
class BitSet {
    constructor(activeBits) {
        this.activeBitsSet = new Set(); // used for checking of value within set
        this.activeBitsVal = []; // used for retreiving value from set
        for (const index of activeBits) {
            this.activeBitsSet.add(index);
        }
        for (const value of this.activeBitsSet.values()) {
            this.activeBitsVal.push(value);
        }
        Object.freeze(this.activeBitsSet);
        Object.freeze(this.activeBitsVal);
        Object.freeze(this);
    }
    getWidth(fallback) {
        return this.activeBitsVal.length;
    }
    isActive(bit) {
        return this.activeBitsSet.has(bit);
    }
    getPairedActiveBit(bit) {
        if (bit >= this.getWidth())
            return -1;
        return this.activeBitsVal[bit];
    }
    getIndexOfPairedBit(bit) {
        return this.activeBitsVal.indexOf(bit);
    }
    copy() { return new BitSet(this.activeBitsVal); }
    // take output of [other], and feed it into [this] (f(g(x)))
    combine(other = new AllBitSet()) {
        if (other instanceof AllBitSet) {
            return this.copy();
        } // anything fed into [other] will be unchanged
        let combinedArr = [];
        const width = other.getWidth();
        for (let i = 0; i < width; i++) {
            let otherIndex = other.getPairedActiveBit(i);
            let thisIndex = this.getPairedActiveBit(otherIndex);
            if (thisIndex == -1) {
                continue;
            } // invalid value, can be safely ignored
            combinedArr.push(thisIndex);
        }
        return new BitSet(combinedArr);
    }
}
exports.BitSet = BitSet;
class AllBitSet extends BitSet {
    constructor() {
        super([]);
    }
    getWidth(fallback = null) { return (fallback == null) ? Infinity : fallback; } // effectively, ignore the width of this
    isActive() { return true; }
    getPairedActiveBit(bit) { return bit; }
    getIndexOfPairedBit(bit) { return bit; }
    combine(other) {
        if (other instanceof AllBitSet)
            return new AllBitSet(); // both have everything
        else
            return other.copy(); // anything fed into [this] will be unchanged
    }
}
exports.AllBitSet = AllBitSet;
const allBitSet = new AllBitSet(); // default to be used anywhere
class Interface {
    constructor(width) {
        this.callbacks = {};
        this.bits = new Bits(width);
    }
    onChange(callback) {
        if (!("change" in this.callbacks))
            this.callbacks.change = [];
        this.callbacks.change.push(callback);
    }
    onSet(callback) {
        if (!("set" in this.callbacks))
            this.callbacks.set = [];
        this.callbacks.set.push(callback);
    }
    onRead(callback) {
        if (!("read" in this.callbacks))
            this.callbacks.read = [];
        this.callbacks.read.push(callback);
    }
    trigger(type, bit, value) {
        if (!(type in this.callbacks))
            return; // cannot trigger that which doesn't exist
        this.callbacks[type].forEach((callback) => { callback(bit, value); }); // trigger callbacks sequentially
    }
    setBit(bit, value, bitSet) {
        bit = bitSet.getPairedActiveBit(bit);
        const isChange = this.bits.setBit(bit, value);
        if (bit == -1)
            return; // invalid bit
        // "set" runs before "change"
        this.trigger("set", bit, value);
        if (isChange)
            this.trigger("change", bit, value);
    }
    setBits(bits, bitSet = new AllBitSet()) {
        const isChange = this.bits.setBits(bits, bitSet);
        // this.trigger("set", -1, false); // sentinal that all bits were changed; value doesn't matter
        // if (isChange) this.trigger("change", -1, false);
        const width = bitSet.getWidth(this.bits.width);
        for (let i = 0; i < width; i++) {
            const index = bitSet.getPairedActiveBit(i);
            if (index == -1) {
                continue;
            } // invalid bit, don't do update
            this.trigger("set", index, bits.getBit(i));
            if (isChange)
                this.trigger("change", index, bits.getBit(i));
        }
    }
    readBit(bit, bitSet) {
        bit = bitSet.getPairedActiveBit(bit);
        if (bit == -1)
            return false; // invalid bit
        const bitVal = this.bits.getBit(bit);
        // useful for anything that triggers on a read
        this.trigger("read", bit, bitVal);
        return bitVal;
    }
    readBits(bitSet = new AllBitSet()) {
        // this.trigger("read", -1, false); // sentinal that all bits were read
        const width = bitSet.getWidth(this.bits.width);
        for (let i = 0; i < width; i++) {
            const index = bitSet.getPairedActiveBit(i);
            if (index == -1) {
                continue;
            }
            ; // invalid bit
            this.trigger("read", index, this.bits.getBit(index));
        }
        return this.bits.copy(bitSet);
    }
}
exports.Interface = Interface;
// an input and an ouptut, with a gate between; gate opens momentarily when called
class Bus {
    constructor(width) {
        this.input = new Interface(width);
        this.output = new Interface(width);
    }
    setInputBit(bit, value) { this.input.setBit(bit, value); }
    setInputBits(bits) { this.input.setBits(bits); }
    assert() { this.output.setBits(this.input.readBits()); } // momentarily opens gate, letting value of input flow to ouput
    getOutputBit(bit) { return this.output.readBit(bit); }
    getOutputBits() { return this.output.readBits(); }
}
exports.Bus = Bus;
class Flags {
    constructor(flagNames) {
        this.flags = new Map();
        for (let i in flagNames) {
            const name = flagNames[i];
            if (!this.flags.has(name))
                this.flags.set(name, +i); // only add unique members
        }
        this.bits = new Bits(this.flags.size);
        Object.freeze(this.flags);
    }
    setFlag(name, value) {
        if (!this.flags.has(name))
            return; // cannot set flag that doesn't exist
        // this.flags.set(name, value);
        this.bits.setBit(this.flags.get(name), value);
    }
    getFlag(name) {
        if (!this.flags.has(name))
            return false; // default value for flag that doesn't exist
        return this.bits.getBit(this.flags.get(name));
    }
    clear() {
        const width = this.bits.width;
        for (let i = 0; i < width; i++) {
            this.bits.setBit(i, false);
        }
    }
    getRawFlags() { return this.bits.copy(); }
}
exports.Flags = Flags;
//# sourceMappingURL=support.js.map