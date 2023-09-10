import { Component, TriggerTypes } from "./components.js";
import { BitSet, Bits, Flags } from "./support.js";

const MAX_LU_CODE = 16;

export enum LogicUnitCodes {
  AND = 0,
  OR,
  XOR,
  NAND,
  NOR,
  XNOR,
  NOTA,
  NOTB,

  // shifts A by B units
  SHIFTL, // replaces empties with 0
  SHIFTR,

  // rolls A by B units
  ROL, // remplaces empties with bit rolled off
  ROR
};

export enum ALUCodes {
  ADD = MAX_LU_CODE, // Logic Unit ends at 15, therefore this series starts at 16
  ADC, // add with carry
  SUB,
  SBC, // sub with carry
  
  MUL,
  DIV, // integer division
  MOD,
  
  POW,
  XROOT,
};

export class LogicUnit extends Component {
  readonly inputASet: BitSet;
  readonly inputBSet: BitSet;
  readonly typeSelectSet: BitSet;
  readonly doOperationSet: BitSet;
  private readonly controlBits: number;
  constructor(
    wordWidth: number,
    controlBits: number = 4
  ) {
    super(wordWidth*2 + controlBits + 1, wordWidth); // 4 bits required to capture all 16 combinations possible with two inputs; 5th bit required for doOperation

    this.controlBits = controlBits;

    const inputAArr: number[] = [];
    const inputBArr: number[] = [];
    for (let i = 0; i < wordWidth; i++) {
      inputAArr.push(i);
      inputBArr.push(wordWidth + i);
    }
    this.inputASet = new BitSet(inputAArr);
    this.inputBSet = new BitSet(inputBArr);

    const typeSelectedArr: number[] = [];
    for (let i = 0; i < this.controlBits; i++) {
      typeSelectedArr.push(wordWidth*2 + i);
    }
    this.typeSelectSet = new BitSet(typeSelectedArr);

    this.doOperationSet = new BitSet([wordWidth*2 + controlBits]);

    this.setInterrupt(this.doOperation.bind(this), TriggerTypes.SetTrue, new BitSet([0]), this.doOperationSet)
  }

  setDoOperation(
    value: boolean
  ) {
    this.setInputBit(0, value, this.doOperationSet);
  }

  setOperation(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.typeSelectSet.combine(bitSet));
  }

  setAInput(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.inputASet.combine(bitSet));
  }

  setBInput(
    bits: Bits,
    bitSet?: BitSet
  ) {
    this.setInputBits(bits, this.inputBSet.combine(bitSet));
  }

  connectAInputFrom(
    other: Component,
    fromBitSet?: BitSet,
    toBitSet?: BitSet
  ) {
    other.connectTo(
      this,
      fromBitSet,
      this.inputASet.combine(toBitSet)
    );
  }

  connectBInputFrom(
    other: Component,
    fromBitSet?: BitSet,
    toBitSet?: BitSet
  ) {
    other.connectTo(
      this,
      fromBitSet,
      this.inputBSet.combine(toBitSet)
    );
  }

  protected doOperation() {
    const inputA = this.getInputBits(this.inputASet);
    const inputB = this.getInputBits(this.inputBSet);
    const operation = this.getInputBits(this.typeSelectSet).getDecimal();

    let output: Bits;
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

// flags:
// (O) overflow
// (U) underflow
// (C) carry
// (Z) zero
// (D) divide-by-zero

export class ALU extends LogicUnit {
  private readonly flags: Flags = new Flags(["O","U","C","Z","D"]);
  constructor(
    wordWidth: number
  ) {
    super(wordWidth, 5); // 5 bits to cover everything the ALU can do (16 dedicated to LU portion)
  }

  protected doOperation() {
    const operation = this.getInputBits(this.typeSelectSet).getDecimal();

    let isCarrySet = this.flags.getFlag("C");
    this.flags.clear(); // reset all flags

    let output: Bits;

    // let standard Logic Unit handle this
    if (operation < MAX_LU_CODE) {
      console.log(ALUCodes)
      super.doOperation();
      output = this.getOutputBits();
    }
    else {
      // arithmetic involved
      const width = this.inputASet.getWidth();
      const inputA = this.getInputBits(this.inputASet).getDecimal();
      const inputB = this.getInputBits(this.inputBSet).getDecimal();

      output = new Bits(width);
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
          if (output.getDecimal() != product) this.flags.setFlag("O", true); // overflow
          break;
        case ALUCodes.DIV:
          if (inputB == 0) this.flags.setFlag("D", true); // leave output at default value of 0, set divide-by-zero flag
          else {
            const quotient = Math.floor(inputA / inputB); // unpossible for this to be overflow/underflow
            output.setDecimal(quotient);
          }
          break;
        case ALUCodes.MOD:
          if (inputB == 0) this.flags.setFlag("D", true); // leave output at default value of 0, set divide-by-zero flag
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
            if (output.getDecimal() != exp) this.flags.setFlag("O", true); // overflow
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

    if (output.getDecimal() == 0) this.flags.setFlag("Z", true); // set zero flag
  }

  getFlag(name: string) {
    return this.flags.getFlag(name);
  }
  setFlag(
    name: string,
    value: boolean
  ) {
    this.flags.setFlag(name,value);
  }
  getRawFlags() { return this.flags.getRawFlags(); }
}