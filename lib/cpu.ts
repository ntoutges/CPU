import { ALU, ALUCodes } from "./ALU.js";
import { Component, TriggerTypes } from "./components.js";
import { BitSet, Bits } from "./support.js";

export enum OpCodes {
  LDA = 0, // load value held at address given by next value
  LAA, // load next value
  STA,
  
  LDB, // load value held at address given by next value
  LAB, // load next value
  STB,

  ADD, // set A to A + B
  ADC, // set A to A + B + carry_bit
  SUB, // set A to A - B
  SBC, // set A to A - B - carry_bit
  OPP, // perform operation on A and B

  JMP, // jump, no matter what
  JMZ, // jump if zero flag set

  NOP // No-Operation
}

enum MicroOps {
  LD = 0, // load from memory
  ST, // store into memory
  SA, // store that on data lines into A
  SB, // store that on data lines into B
  SW, // store that on data lines to top of working storage
  PA, // push that in A onto data lines
  PB, // push that in B onto data lines

  AS, // (A)LU (S)et -- set mode of ALU based on working storage (cache); also make ALU do operation on its two inputs
  AL, // (A)LU (L)oad -- load data into ALU
  AR, // (A)LU (R)etrieve -- get output from ALU and store into A register
  
  JP, // jump
  JZ // reads zero flag, and if set, jump
}

enum CpuState {
  Fetch1=0, //  put PC on address line
  Fetch2, // read from data line and load into opcode register
  Dexecute // run commands based on opcode register
}

// basic implementation for validation purposes only
export class CPU extends Component{
  private readonly alu: ALU;
  readonly addressSet: BitSet;
  readonly outputDataSet: BitSet;
  readonly inputDataSet: BitSet;
  readonly clockSet: BitSet;
  readonly memOpSet: BitSet;
  
  readonly wordWidth: number;

  readonly cache: Bits[] = [];
  readonly microOps: MicroOps[] = []; // stack of micro-operations

  private readonly A: Bits;
  private readonly B: Bits;
  
  private pc: Bits; // program counter
  private opcode: number = OpCodes.NOP;
  private state: CpuState = CpuState.Fetch1;

  constructor ( wordWidth: number ) {
    super(wordWidth + 1, wordWidth + wordWidth + 2); // 1 added to input for clock // 2 added to output for memory RW and CS lines 
    this.wordWidth = wordWidth;

    const addressSetArr: number[] = [];
    for (let i = 0; i < wordWidth; i++) { addressSetArr.push(i); }
    this.addressSet = new BitSet(addressSetArr);

    const dataSetIn: number[] = [];
    const dataSetOut: number[] = [];
    for (let i = 0; i < wordWidth; i++) {
      dataSetOut.push(wordWidth+i);
      dataSetIn.push(i);
    }
    this.outputDataSet = new BitSet(dataSetOut);
    this.inputDataSet = new BitSet(dataSetIn);

    this.memOpSet = new BitSet([wordWidth+wordWidth, wordWidth+wordWidth+1]); // +0 -> RW, +1 -> CS

    this.clockSet = new BitSet([wordWidth]);

    this.alu = new ALU(wordWidth);
    this.pc = new Bits(wordWidth);

    this.A = new Bits(wordWidth);
    this.B = new Bits(wordWidth);
    
    this.setInterrupt(this.tick.bind(this), TriggerTypes.RisingEdge, new BitSet([0]), this.clockSet);
  }

  setClock(
    value: boolean
  ) {
    this.setInputBit(0, value, this.clockSet);
  }

  private tick() {
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
          this.loadOperation()
        break;
      case CpuState.Dexecute:
        if (this.microOps.length == 0) {
          this.state = CpuState.Fetch1;
        }
        else {
          this.doMicroOp(this.microOps[0]);
          this.microOps.splice(0,1); // get rid of first micro operation in list
        }
        break;
    }
  }
  private advancePC() {
    this.pc.setDecimal(this.pc.getDecimal() + 1); // increment PC by 1
  }

  // microops assumed empty
  loadOperation() {
    switch (this.opcode) {
      case OpCodes.LDA: {
        const nextAddr = new Bits(this.wordWidth);
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
        const nextAddr = new Bits(this.wordWidth);
        nextAddr.setBits(this.pc);
        this.advancePC();
        this.cache.push(nextAddr);
        this.microOps.push(MicroOps.LD); // this address reads value to push to A
        this.microOps.push(MicroOps.SA); // pushes data into A register
        break;
      }
      case OpCodes.STA: {
        const nextAddr = new Bits(this.wordWidth);
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
        const nextAddr = new Bits(this.wordWidth);
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
        const nextAddr = new Bits(this.wordWidth);
        nextAddr.setBits(this.pc);
        this.advancePC();
        this.cache.push(nextAddr);
        this.microOps.push(MicroOps.LD); // this command reads what to push into B
        this.microOps.push(MicroOps.SB); // pushes data into A register
        break;
      }
      case OpCodes.STB: {
        const nextAddr = new Bits(this.wordWidth);
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
        const addCode = new Bits(5);
        addCode.setDecimal(ALUCodes.ADD);
        this.cache.push(addCode);
        this.microOps.push(MicroOps.AL); // load A and B into ALU
        this.microOps.push(MicroOps.AS); // set operation to data on cache
        this.microOps.push(MicroOps.AR); // lost final ALU data into A
        break;
      }
      case OpCodes.ADC: {
        const addCode = new Bits(5);
        addCode.setDecimal(ALUCodes.ADC);
        this.cache.push(addCode);
        this.microOps.push(MicroOps.AL); // load A and B into ALU
        this.microOps.push(MicroOps.AS); // set operation to data on cache
        this.microOps.push(MicroOps.AR); // lost final ALU data into A
        break;
      }
      case OpCodes.SUB:{
        const addCode = new Bits(5);
        addCode.setDecimal(ALUCodes.SUB);
        this.cache.push(addCode);
        this.microOps.push(MicroOps.AL); // load A and B into ALU
        this.microOps.push(MicroOps.AS); // set operation to data on cache
        this.microOps.push(MicroOps.AR); // lost final ALU data into A
        break;
      }
      case OpCodes.SBC:{
        const addCode = new Bits(5);
        addCode.setDecimal(ALUCodes.SBC);
        this.cache.push(addCode);
        this.microOps.push(MicroOps.AL); // load A and B into ALU
        this.microOps.push(MicroOps.AS); // set operation to data on cache
        this.microOps.push(MicroOps.AR); // push final ALU data into A
        break;
      }
      case OpCodes.OPP:{
        const nextAddr = new Bits(this.wordWidth);
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
        const nextAddr = new Bits(this.wordWidth);
        nextAddr.setBits(this.pc);
        this.advancePC();
        this.cache.push(nextAddr);
        this.microOps.push(MicroOps.LD); // reads where to jump to
        this.microOps.push(MicroOps.SW); // push data lines into cache

        this.microOps.push(MicroOps.JP);
        break;
      }
      case OpCodes.JMZ: {
        const nextAddr = new Bits(this.wordWidth);
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

  doMicroOp(op: MicroOps) {
    switch (op) {
      case MicroOps.LD: { // load from memory
        const address = (this.cache.length > 0) ? this.cache.pop() : new Bits(this.wordWidth);
        this.setOutputBits(address, this.addressSet);
        this.setOutputBit(1, true, this.memOpSet); // ensure chip is selected
        this.setOutputBit(0, false, this.memOpSet); // ensure this is in read mode
        break;
      }
      case MicroOps.ST: { // store whatever is on data pins into memory
        const address = (this.cache.length > 0) ? this.cache.pop() : new Bits(this.wordWidth);
        this.setOutputBits(address, this.addressSet);
        this.setOutputBit(1, true, this.memOpSet); // ensure chip is selected
        this.setOutputBit(0, true, this.memOpSet); // ensure this is in write mode
        break;
      }
      case MicroOps.SW: // store into working-memory
        this.cache.push(
          this.getInputBits(
            this.inputDataSet
          )
        );
        break;
      case MicroOps.SA: // store into A
        this.A.setBits(
          this.getInputBits(
            this.inputDataSet
          )
        );
        break;
      case MicroOps.SB: // store into B
        this.B.setBits(
          this.getInputBits(
            this.inputDataSet
          )
        );
        break;
      case MicroOps.PA: // push from A
        this.setOutputBits(
          this.A,
          this.outputDataSet
        );
        break;
      case MicroOps.PB: // push from B
        this.setOutputBits(
          this.B,
          this.outputDataSet
        );
        break;
      case MicroOps.AS: { // set ALU mode, and make ALU do operation
        const operation = (this.cache.length > 0) ? this.cache.pop() : new Bits(this.wordWidth);
        this.alu.setOperation(operation);
        this.alu.setDoOperation(true);
        break;
      }
      case MicroOps.AL: // load A and B into ALU
        this.alu.setAInput(this.A);
        this.alu.setBInput(this.B);
        break;
      case MicroOps.AR: // set output of ALU into A
        this.A.setBits(
          this.alu.getOutputBits()
        );
        break;
      case MicroOps.JP: { // jumps to location stored in cache
        const address = new Bits(this.wordWidth); // default value of 0
        if (this.cache.length > 0) address.setDecimal(this.cache.pop().getDecimal()); // subtract 1 from value, because value automatically incremented by 1 before execution
        
        this.pc.setBits( address ); // jump to address
        break;
      }
      case MicroOps.JZ: {
        const address = (this.cache.length > 0) ? this.cache.pop() : new Bits(this.wordWidth); // default value of 0

        if (this.alu.getFlag("Z")) {
          this.pc.setBits(address);
        }
        break;
      }
    }
  }
}