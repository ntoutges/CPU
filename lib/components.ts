import { BitSet, Bits, Interface, bitCallback } from "./support.js";

export enum TriggerTypes {
  FallingEdge, // whenever value changes from true to false -> trigger
  RisingEdge, // whenever value changes from false to true -> trigger
  RisingFallingEdge, // whenever value changes -> trigger
  Set, // set to anything
  SetTrue, // whenever value is set to true (even if no change) -> trigger
  SetFalse // whenever value is set to false (even if no change) -> trigger
};

export class Component {
  protected readonly input: Interface;
  protected readonly output: Interface;
  constructor(
    inputWidth: number,
    outputWidth: number
  ) {
    this.input = new Interface(inputWidth);
    this.output = new Interface(outputWidth);
  }

  setInputBit(
    bit: number,
    value: boolean,
    bitSet?: BitSet
  ) {
    this.input.setBit(bit,value, bitSet);
  }
  setInputBits(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.input.setBits(bits, bitSet);
  }
  
  getOutputBit(
    bit: number,
    bitSet?: BitSet
  ) {
    return this.output.readBit(bit, bitSet);
  }
  getOutputBits(
    bitSet?: BitSet
  ) {
    return this.output.readBits(bitSet);
  }

  connectTo(
    other: Component,
    fromBitSet?: BitSet,
    toBitSet?: BitSet
  ) {
    this.output.onSet((bit, value) => {
      // if (bit == -1) {
        //   other.setInputBits(this.getInputBits(fromBitSet), toBitSet);
        // }
        if (!fromBitSet.isActive(bit)) return; // this bit not present in fromBitSet, ignore
        else {
          bit = fromBitSet.getIndexOfPairedBit(bit); // get index from [fromBitSet]
          other.setInputBit(bit, value, toBitSet);
        }
    });
  }

  // the following are only for internal use WITHIN subclasses
  protected getInputBit(
    bit: number,
    bitSet?: BitSet
  ) {
    return this.input.readBit(bit, bitSet);
  }
  protected getInputBits(
    bitSet?: BitSet
  ) {
    return this.input.readBits(bitSet);
  }
  
  protected setOutputBit(
    bit: number,
    value: boolean,
    bitSet?: BitSet
  ) {
    this.output.setBit(bit,value, bitSet);
  }
  protected setOutputBits(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.output.setBits(bits, bitSet);
  }

  protected setInterrupt(
    callback: bitCallback,
    triggerType: TriggerTypes,
    bits: BitSet,
    bitSet?: BitSet,
  ) {
    bits = bitSet.combine(bits);
    if (bits.getWidth() == 0) return; // invalid bit will never be changed
    switch (triggerType) {
      case TriggerTypes.FallingEdge:
        this.input.onChange((l_bit,l_value) => { if (bits.isActive(l_bit) && !l_value) { callback(l_bit, l_value); } });
        break;
      case TriggerTypes.RisingEdge:
        this.input.onChange((l_bit,l_value) => { if (bits.isActive(l_bit) && l_value) { callback(l_bit, l_value); } });
        break;
      case TriggerTypes.RisingFallingEdge:
        this.input.onChange((l_bit,l_value) => { if (bits.isActive(l_bit)) { callback(l_bit, l_value); } });
        break;
      case TriggerTypes.Set:
        this.input.onSet((l_bit, l_value) => { if (!l_value) callback(l_bit, l_value); });
        break;
      case TriggerTypes.SetFalse:
        this.input.onSet((l_bit, l_value) => { if (bits.isActive(l_bit) && !l_value) callback(l_bit, l_value); });
        break;
      case TriggerTypes.SetTrue:
        this.input.onSet((l_bit, l_value) => { if (bits.isActive(l_bit) && l_value) callback(l_bit, l_value); });
        break;
    }
  }
}

export class RAM extends Component {
  private readonly memory: Bits[] = [];
  readonly memoryAddressSet: BitSet;
  readonly memoryDataSet: BitSet;
  readonly memoryControlSet: BitSet;
  readonly wordSize: number;
  private isEnabled: boolean = false;
  constructor(
    addressBits: number,
    wordSize: number
  ) {
    const totalPins = addressBits + wordSize + 1; // +1 adds in: R/W signal;

    super(totalPins, wordSize);
    // this.memory = new Bits(2 ** totalBits); // this grows exponentially... might want to make a new "FutureBits" class to dynamically grow size of bits
    const wordCount = 2 ** addressBits; // this grows exponentially... might want to make a new "FutureBits" class to dynamically grow size of bits
    for (let i = 0; i < wordCount; i++) {
      this.memory.push( new Bits(wordSize) );
    }
    
    this.wordSize = wordSize;

    const addressPins: number[] = [];
    for (let i = 0; i < addressBits; i++) { addressPins.push(i); }
    this.memoryAddressSet = new BitSet(addressPins);

    const dataPins: number[] = [];
    for (let i = 0; i < wordSize; i++) { dataPins.push(addressBits + i); }
    this.memoryDataSet = new BitSet(dataPins);

    const controlPins = [addressBits + wordSize, addressBits + wordSize + 1]; // [Read/Write, Enable]
    this.memoryControlSet = new BitSet(controlPins);

    this.setInterrupt(this.performWrite.bind(this),  TriggerTypes.SetTrue, new BitSet([0]), this.memoryControlSet);
    this.setInterrupt(this.performRead.bind(this), TriggerTypes.SetFalse, new BitSet([0]), this.memoryControlSet);
    this.setInterrupt(this.changeEnableState.bind(this), TriggerTypes.Set, new BitSet([0,1]), this.memoryControlSet);
  }

  setAddress(
    bits: Bits,
    bitSet?: BitSet
  ) {
    if (!this.isEnabled) return; // ignore everything if not enabled
    this.setInputBits(bits, this.memoryAddressSet.combine(bitSet));
  }

  setData(
    bits: Bits,
    bitSet?: BitSet
  ) {
    if (!this.isEnabled) return; // ignore everything if not enabled
    this.setInputBits(bits, this.memoryDataSet.combine(bitSet));
  }
  getData(
    bitSet?: BitSet
  ) {
    return this.getOutputBits(bitSet); // only output pins are data pins, therefore no extra set needed to be combined
  }

  // 0->(R)ead, 1->(W)rite
  setRW(
    bit: boolean
  ) {
    if (!this.isEnabled) return; // ignore everything if not enabled
    this.setInputBit(0, bit, this.memoryControlSet );
  }

  // 0->disabled, 1->enabled
  setEN(
    bit: boolean
  ) {
    if (!this.isEnabled) return; // ignore everything if not enabled
    this.setInputBit(1, bit, this.memoryControlSet );
  }

  // used for initial setup
  setWord(
    bits: Bits | number,
    address: number
  ) {
    if (address >= this.memory.length) return; // invalid address
    if (typeof bits == "number") this.memory[address].setDecimal(bits);
    else this.memory[address].setBits(bits);
  }

  setWords(
    bits: Array<Bits | number>,
    offsetAddress: number
  ) {
    for (let i = 0; i < bits.length; i++) {
      this.setWord(bits[i], offsetAddress + i)
    }
  }

  getWord(
    address: number
  ) {
    if (address >= this.memory.length) return null; // invalid address
    return this.memory[address].copy();
  }

  getWords() {
    return this.memory;
  }

  private performWrite() {
    const numericAddress = this.getInputBits(this.memoryAddressSet).getDecimal();
    const value = this.getInputBits(this.memoryDataSet);

    this.memory[numericAddress].setBits(value);
  }

  private performRead() {
    const numericAddress = this.getInputBits(this.memoryAddressSet).getDecimal();
    this.setOutputBits(this.memory[numericAddress]); // no BitSet needed, because the only output pins are for data bits
  }

  private changeEnableState(bit: number, value: boolean) {
    this.isEnabled = value;
  }
}

export class OutputSelector extends Component {
  readonly selectorInputSet: BitSet;
  readonly selectorBitSet: BitSet;
  readonly outputSets: BitSet[] = [];
  constructor(
    width: number,
    inputSelectorBits: number,
    outputCount: number
  ) {
    super(width + inputSelectorBits, width*outputCount);

    const selectorInputArr: number[] = []; // data input
    for (let i = 0; i < width; i++) { selectorInputArr.push(i); }
    this.selectorInputSet = new BitSet(selectorInputArr);

    const selectorBitSet: number[] = []; // selects output
    for (let i = 0; i < inputSelectorBits; i++) { selectorBitSet.push(width + i); }
    this.selectorBitSet = new BitSet(selectorBitSet);

    for (let i = 0; i < outputCount; i++) {
      let outputSetData: number[] = [];
      for (let j = 0; j < width; j++) {
        outputSetData.push(width*i+j);
      }
      this.outputSets.push(new BitSet(outputSetData));
    }
  }

  selectOutput(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.selectorBitSet.combine(bitSet));
  }
  
  setInput(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.selectorInputSet.combine(bitSet));
  }

  getOutput(
    outputIndex: number,
    bitSet?: BitSet
  ) {
    if (outputIndex >= this.outputSets.length) return new Bits(0); // invalid
    return this.getOutputBits(this.outputSets[outputIndex].combine(bitSet));
  }

  connectOutputTo(
    other: Component,
    outputId: number,
    fromBitSet?: BitSet,
    toBitSet?: BitSet
  ) {
    if (outputId >= this.outputSets.length) return; // invalid output id
    super.connectTo(other, this.outputSets[outputId].combine(fromBitSet), toBitSet);
  }
}

export class InputSelector extends Component {
  readonly selectorInputSets: BitSet[] = [];
  readonly selectorBitSet: BitSet;
  readonly outputSet: BitSet;
  constructor(
    width: number,
    inputSelectorBits: number,
    inputCount: number
  ) {
    super(width + inputSelectorBits*inputCount, width);

    const selectorOutputArr: number[] = []; // data input
    for (let i = 0; i < width; i++) { selectorOutputArr.push(i); }
    this.outputSet = new BitSet(selectorOutputArr);

    for (let i = 0; i < inputCount; i++) {
      let inputSetData: number[] = [];
      for (let j = 0; j < width; j++) {
        inputSetData.push(width*i+j);
      }
      this.selectorInputSets.push(new BitSet(inputSetData));
    }

    const start = inputCount * width;
    const selectorBitSet: number[] = []; // selects output
    for (let i = 0; i < inputSelectorBits; i++) { selectorBitSet.push(start + i); }
    this.selectorBitSet = new BitSet(selectorBitSet);
  }

  selectOutput(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.selectorBitSet.combine(bitSet));
  }
  
  setInput(
    bits: Bits,
    inputId: number,
    bitSet?: BitSet
  ) {
    if (inputId >= this.selectorInputSets.length) return; // invalid
    this.setInputBits(bits, this.selectorInputSets[inputId].combine(bitSet));
  }

  connectInputFrom(
    other: Component,
    inputId: number,
    fromBitSet?: BitSet,
    toBitSet?: BitSet
  ) {
    if (inputId >= this.selectorInputSets.length) return; // invalid inputId

    other.connectTo(
      this,
      fromBitSet,
      this.selectorInputSets[inputId].combine(toBitSet)
    );
  }
}
