import { ALU, ALUCodes, LogicUnit, LogicUnitCodes } from "./ALU.js";
import { RAM } from "./components.js";
import { CPU, OpCodes } from "./cpu.js";
import { AllBitSet, Bits, BitSet } from "./support.js";

export function test() {
  const cpu = new CPU(8);
  const ram = new RAM(8,8);

  cpu.connectTo(
    ram,
    cpu.addressSet,
    ram.memoryAddressSet
  )
  cpu.connectTo(
    ram,
    cpu.memOpSet,
    ram.memoryControlSet
  );
  cpu.connectTo(
    ram,
    cpu.outputDataSet,
    ram.memoryDataSet
  )
  ram.connectTo(
    cpu,
    new AllBitSet(),
    cpu.inputDataSet
  )

  ram.setWords([
    OpCodes.LDA, 10, // load value at address 10
    OpCodes.LDB, 11, // load value at address 11
    OpCodes.ADD,
    OpCodes.STA, 255,
    OpCodes.JMP, 7,
    0, // filler
    20,40
  ], 0);

  ram.setEN(true);
  const ad = new Bits(4);
  ad.setDecimal(1)
  ram.setAddress(ad);

  // cpu.setClock(true)
  for (let i = 0; i < 100; i++) {
    cpu.setClock(i % 2 == 0);
  }

  console.log(ram.getWord(255).getDecimal());

}