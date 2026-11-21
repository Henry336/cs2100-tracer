import type { ReactNode } from 'react'
import { Callout, DataTable, Panel, Workspace, type Column } from '../../ui/kit'
import './reference.css'

type Row = Record<string, ReactNode>

function cols(keys: string[], opts: { mono?: string[]; center?: string[]; headers?: Record<string, string> } = {}): Column<Row>[] {
  return keys.map((k) => ({
    key: k,
    header: opts.headers?.[k] ?? k,
    cell: (r: Row) => r[k],
    mono: opts.mono?.includes(k),
    align: opts.center?.includes(k) ? 'center' : 'left',
  }))
}

const REG_NAMES = [
  '$zero', '$at', '$v0', '$v1', '$a0', '$a1', '$a2', '$a3',
  '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
  '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$t8', '$t9', '$k0', '$k1', '$gp', '$sp', '$fp', '$ra',
]

function regUse(n: number): string {
  if (n === 0) return 'constant 0'
  if (n === 1) return 'assembler temporary'
  if (n <= 3) return 'results'
  if (n <= 7) return 'arguments'
  if (n <= 15) return 'temporaries'
  if (n <= 23) return 'saved'
  if (n <= 25) return 'temporaries'
  if (n <= 27) return 'kernel'
  return ['global pointer', 'stack pointer', 'frame pointer', 'return address'][n - 28]
}

const REGS: Row[] = REG_NAMES.map((name, n) => ({ No: n, Name: name, Binary: n.toString(2).padStart(5, '0'), Use: regUse(n) }))

const INSTR: Row[] = [
  { Instruction: 'add', Format: 'R', Opcode: '0', Funct: '20', Meaning: 'rd = rs + rt' },
  { Instruction: 'sub', Format: 'R', Opcode: '0', Funct: '22', Meaning: 'rd = rs − rt' },
  { Instruction: 'and', Format: 'R', Opcode: '0', Funct: '24', Meaning: 'rd = rs AND rt' },
  { Instruction: 'or', Format: 'R', Opcode: '0', Funct: '25', Meaning: 'rd = rs OR rt' },
  { Instruction: 'nor', Format: 'R', Opcode: '0', Funct: '27', Meaning: 'rd = NOT(rs OR rt)' },
  { Instruction: 'slt', Format: 'R', Opcode: '0', Funct: '2A', Meaning: 'rd = (rs < rt) ? 1 : 0' },
  { Instruction: 'sll', Format: 'R', Opcode: '0', Funct: '00', Meaning: 'rd = rt << shamt (rs = 0)' },
  { Instruction: 'srl', Format: 'R', Opcode: '0', Funct: '02', Meaning: 'rd = rt >> shamt (logical)' },
  { Instruction: 'jr', Format: 'R', Opcode: '0', Funct: '08', Meaning: 'PC = rs' },
  { Instruction: 'addi', Format: 'I', Opcode: '08', Funct: '', Meaning: 'rt = rs + SignExt(imm)' },
  { Instruction: 'slti', Format: 'I', Opcode: '0A', Funct: '', Meaning: 'rt = (rs < SignExt(imm)) ? 1 : 0' },
  { Instruction: 'andi', Format: 'I', Opcode: '0C', Funct: '', Meaning: 'rt = rs AND ZeroExt(imm)' },
  { Instruction: 'ori', Format: 'I', Opcode: '0D', Funct: '', Meaning: 'rt = rs OR ZeroExt(imm)' },
  { Instruction: 'lui', Format: 'I', Opcode: '0F', Funct: '', Meaning: 'rt = imm << 16' },
  { Instruction: 'lw', Format: 'I', Opcode: '23', Funct: '', Meaning: 'rt = Mem[rs + SignExt(imm)] (word)' },
  { Instruction: 'sw', Format: 'I', Opcode: '2B', Funct: '', Meaning: 'Mem[rs + SignExt(imm)] = rt' },
  { Instruction: 'lb', Format: 'I', Opcode: '20', Funct: '', Meaning: 'rt = SignExt(Mem byte)' },
  { Instruction: 'sb', Format: 'I', Opcode: '28', Funct: '', Meaning: 'Mem byte = low byte of rt' },
  { Instruction: 'beq', Format: 'I', Opcode: '04', Funct: '', Meaning: 'if rs = rt: PC = PC+4 + imm×4' },
  { Instruction: 'bne', Format: 'I', Opcode: '05', Funct: '', Meaning: 'if rs ≠ rt: PC = PC+4 + imm×4' },
  { Instruction: 'j', Format: 'J', Opcode: '02', Funct: '', Meaning: 'PC = {PC+4[31:28], target, 00}' },
  { Instruction: 'jal', Format: 'J', Opcode: '03', Funct: '', Meaning: '$ra = PC+4 (L08 p8), then jump' },
]

const FORMATS: Row[] = [
  { Format: 'R', Fields: 'opcode 6 | rs 5 | rt 5 | rd 5 | shamt 5 | funct 6', Bits: '31-26 | 25-21 | 20-16 | 15-11 | 10-6 | 5-0' },
  { Format: 'I', Fields: 'opcode 6 | rs 5 | rt 5 | immediate 16', Bits: '31-26 | 25-21 | 20-16 | 15-0' },
  { Format: 'J', Fields: 'opcode 6 | target 26', Bits: '31-26 | 25-0' },
]

const PSEUDO: Row[] = [
  { Pseudo: 'bgt $r1, $r2, L', Expansion: 'slt $at, $r2, $r1 ; bne $at, $zero, L' },
  { Pseudo: 'bge $r1, $r2, L', Expansion: 'slt $at, $r1, $r2 ; beq $at, $zero, L' },
  { Pseudo: 'blt $r1, $r2, L', Expansion: 'slt $at, $r1, $r2 ; bne $at, $zero, L' },
  { Pseudo: 'ble $r1, $r2, L', Expansion: 'slt $at, $r2, $r1 ; beq $at, $zero, L' },
  { Pseudo: 'move $d, $s', Expansion: 'add $d, $s, $zero' },
  { Pseudo: 'li $r, imm (fits 16 bits)', Expansion: 'ori $r, $zero, imm' },
  { Pseudo: 'li $r, imm (32 bits)', Expansion: 'lui $r, upper ; ori $r, $r, lower' },
  { Pseudo: 'nop', Expansion: 'sll $zero, $zero, 0 (word 0x00000000)' },
]

const SIGNAL_KEYS = ['RegDst', 'ALUSrc', 'MemToReg', 'RegWrite', 'MemRead', 'MemWrite', 'Branch', 'ALUop']

const CONTROL: Row[] = [
  { Instr: 'R-type', RegDst: '1', ALUSrc: '0', MemToReg: '0', RegWrite: '1', MemRead: '0', MemWrite: '0', Branch: '0', ALUop: '10' },
  { Instr: 'lw', RegDst: '0', ALUSrc: '1', MemToReg: '1', RegWrite: '1', MemRead: '1', MemWrite: '0', Branch: '0', ALUop: '00' },
  { Instr: 'sw', RegDst: 'X', ALUSrc: '1', MemToReg: 'X', RegWrite: '0', MemRead: '0', MemWrite: '1', Branch: '0', ALUop: '00' },
  { Instr: 'beq', RegDst: 'X', ALUSrc: '0', MemToReg: 'X', RegWrite: '0', MemRead: '0', MemWrite: '0', Branch: '1', ALUop: '01' },
]

const SIGNALS: Row[] = [
  { Signal: 'RegDst', v0: 'write register = rt (Inst[20:16])', v1: 'write register = rd (Inst[15:11])' },
  { Signal: 'ALUSrc', v0: 'ALU B = Read data 2', v1: 'ALU B = SignExt(Inst[15:0])' },
  { Signal: 'MemToReg', v0: 'write data = ALU result', v1: 'write data = memory Read Data (mux inputs swapped on the slide)' },
  { Signal: 'RegWrite', v0: 'no register write', v1: 'write WD into register WR' },
  { Signal: 'MemRead', v0: 'no memory read', v1: 'read Mem[Address]' },
  { Signal: 'MemWrite', v0: 'no memory write', v1: 'Mem[Address] = Read data 2' },
  { Signal: 'PCSrc = Branch AND isZero', v0: 'next PC = PC + 4', v1: 'next PC = (PC + 4) + SignExt(imm) × 4' },
]

const ALU_CONTROL: Row[] = [
  { Instr: 'lw / sw', ALUop: '00', Funct: 'xxxxxx', Action: 'add', ALUcontrol: '0010' },
  { Instr: 'beq', ALUop: '01', Funct: 'xxxxxx', Action: 'subtract', ALUcontrol: '0110' },
  { Instr: 'add', ALUop: '10', Funct: '100000', Action: 'add', ALUcontrol: '0010' },
  { Instr: 'sub', ALUop: '10', Funct: '100010', Action: 'subtract', ALUcontrol: '0110' },
  { Instr: 'and', ALUop: '10', Funct: '100100', Action: 'AND', ALUcontrol: '0000' },
  { Instr: 'or', ALUop: '10', Funct: '100101', Action: 'OR', ALUcontrol: '0001' },
  { Instr: 'slt', ALUop: '10', Funct: '101010', Action: 'set on less than', ALUcontrol: '0111' },
]

const ALU_CODES: Row[] = [
  { ALUcontrol: '0000', Function: 'AND' },
  { ALUcontrol: '0001', Function: 'OR' },
  { ALUcontrol: '0010', Function: 'add' },
  { ALUcontrol: '0110', Function: 'subtract' },
  { ALUcontrol: '0111', Function: 'slt' },
  { ALUcontrol: '1100', Function: 'NOR' },
]

const STAGE_CONTROL: Row[] = [
  { Stage: 'EX', Signals: 'RegDst, ALUSrc, ALUop' },
  { Stage: 'MEM', Signals: 'MemRead, MemWrite, Branch' },
  { Stage: 'WB', Signals: 'MemToReg, RegWrite' },
]

const HAZARDS: Row[] = [
  { Situation: 'RAW, no forwarding, consumer right after producer', Stall: '2 cycles', Rule: 'consumer ID waits for producer WB (write first half, read second half)' },
  { Situation: 'RAW, no forwarding, distance 2', Stall: '1 cycle', Rule: 'same rule' },
  { Situation: 'RAW, no forwarding, distance 3 or more', Stall: '0', Rule: 'same rule' },
  { Situation: 'RAW, forwarding, ALU producer', Stall: '0', Rule: 'EX/MEM to EX, or MEM/WB to EX' },
  { Situation: 'RAW, forwarding, lw then immediate use', Stall: '1 cycle', Rule: 'load-use: data only ready after MEM' },
  { Situation: 'WAR or WAW', Stall: '0', Rule: 'not a hazard in this in-order 5-stage pipeline (L21 p14)' },
  { Situation: 'Branch resolved in MEM, no prediction', Stall: '3 cycles', Rule: 'next fetch after the branch MEM' },
  { Situation: 'Branch resolved in ID (early branch), no prediction', Stall: '1 cycle', Rule: 'next fetch after the branch ID' },
  { Situation: 'Predict not taken', Stall: '0 if not taken; 3 (MEM) or 1 (ID) if taken', Rule: 'wrong-path instructions flushed' },
  { Situation: 'Early branch needs ALU result just before it', Stall: '+1 cycle', Rule: 'forward ALU to ID (L21 p38)' },
  { Situation: 'Early branch needs lw result just before it', Stall: '+2 cycles', Rule: 'forward MEM to ID (L21 p39)' },
]

const TIMING: Row[] = [
  { Design: 'Single-cycle', Cycle: 'slowest instruction (sum of its stages)', Time: 'I × cycle time' },
  { Design: 'Multi-cycle', Cycle: 'slowest stage', Time: 'I × average CPI × cycle time' },
  { Design: 'Pipelined (N stages)', Cycle: 'slowest stage + pipeline register delay', Time: '(I + N − 1) × cycle time' },
]

const CACHE: Row[] = [
  { Quantity: 'Offset bits', Formula: 'log2(block size in bytes)' },
  { Quantity: 'Number of blocks', Formula: 'cache size ÷ block size' },
  { Quantity: 'Number of sets', Formula: 'blocks ÷ associativity (1 set for fully associative)' },
  { Quantity: 'Index bits', Formula: 'log2(blocks) direct mapped, log2(sets) set associative, 0 fully associative' },
  { Quantity: 'Tag bits', Formula: 'address bits − index bits − offset bits' },
  { Quantity: 'Block number', Formula: 'address ÷ block size' },
  { Quantity: 'Index', Formula: 'block number mod (blocks or sets)' },
  { Quantity: 'Tag', Formula: 'block number ÷ (blocks or sets)' },
  { Quantity: 'Hit', Formula: 'valid AND tag match' },
  { Quantity: 'Average access time', Formula: 'hit rate × hit time + (1 − hit rate) × miss penalty (penalty includes hit time, L22 p21)' },
  { Quantity: 'Miss penalty, one word at a time (R12)', Formula: '(block size ÷ 4) × time per word, +1 if restart is counted' },
  { Quantity: 'Cycles lost to data misses (R12)', Formula: 'instructions × data-access fraction × miss rate × miss penalty' },
]

const MISSES: Row[] = [
  { Type: 'Cold (compulsory)', When: 'first access to that block ever, even if the line holds another block' },
  { Type: 'Conflict', When: 'block was cached before but evicted because others map to the same set (direct mapped or set associative)' },
  { Type: 'Capacity', When: 'cache too small for the working set; a fully associative cache of the same size also misses' },
]

const WRITES: Row[] = [
  { Case: 'Write hit, write-through', Effect: 'write cache and memory (a write buffer lets the CPU carry on)' },
  { Case: 'Write hit, write-back', Effect: 'write cache only, set dirty bit; memory updated only when a dirty block is evicted' },
  { Case: 'Write miss, write allocate', Effect: 'load the block into the cache, then write as a hit' },
  { Case: 'Write miss, write around (no allocate)', Effect: 'write memory only, cache unchanged' },
]

const FF_CHAR: Row[] = [
  { FF: 'D', Behaviour: 'Q+ = D', Equation: 'Q+ = D' },
  { FF: 'JK', Behaviour: '00 hold, 01 reset, 10 set, 11 toggle', Equation: "Q+ = J·Q' + K'·Q" },
  { FF: 'T', Behaviour: '0 hold, 1 toggle', Equation: "Q+ = T·Q' + T'·Q" },
  { FF: 'SR', Behaviour: '00 hold, 01 reset, 10 set, 11 invalid', Equation: "Q+ = S + R'·Q (S·R = 0)" },
]

const FF_EXC: Row[] = [
  { Q: '0 → 0', JK: '0 X', SR: '0 X', D: '0', T: '0' },
  { Q: '0 → 1', JK: '1 X', SR: '1 0', D: '1', T: '1' },
  { Q: '1 → 0', JK: 'X 1', SR: '0 1', D: '0', T: '1' },
  { Q: '1 → 1', JK: 'X 0', SR: 'X 0', D: '1', T: '0' },
]

const LAWS: Row[] = [
  { Law: 'Identity', AND: 'A·1 = A', OR: 'A + 0 = A' },
  { Law: 'Null element', AND: 'A·0 = 0', OR: 'A + 1 = 1' },
  { Law: 'Complement', AND: "A·A' = 0", OR: "A + A' = 1" },
  { Law: 'Idempotency', AND: 'A·A = A', OR: 'A + A = A' },
  { Law: 'Involution', AND: "(A')' = A", OR: '' },
  { Law: 'Commutative', AND: 'A·B = B·A', OR: 'A + B = B + A' },
  { Law: 'Associative', AND: 'A·(B·C) = (A·B)·C', OR: 'A + (B + C) = (A + B) + C' },
  { Law: 'Distributive', AND: 'A·(B + C) = A·B + A·C', OR: 'A + B·C = (A + B)·(A + C)' },
  { Law: 'Absorption 1', AND: 'A·(A + B) = A', OR: 'A + A·B = A' },
  { Law: 'Absorption 2', AND: "A·(A' + B) = A·B", OR: "A + A'·B = A + B" },
  { Law: 'DeMorgan', AND: "(A·B)' = A' + B'", OR: "(A + B)' = A'·B'" },
  { Law: 'Consensus', AND: "(A+B)·(A'+C)·(B+C) = (A+B)·(A'+C)", OR: "A·B + A'·C + B·C = A·B + A'·C" },
]

const XOR: Row[] = [
  { Identity: "A ⊕ B = A'·B + A·B'", Source: 'L17 p7' },
  { Identity: "(A ⊕ B)' = A ⊙ B = A·B + A'·B'", Source: 'L14 p6, L17 p10' },
  { Identity: '(X ⊕ Y) ⊕ Z = X ⊕ (Y ⊕ Z)', Source: 'L17 p11' },
  { Identity: "A ⊕ 0 = A,  A ⊕ 1 = A',  A ⊕ A = 0,  A ⊕ A' = 1", Source: 'from the truth table' },
  { Identity: "A ⊕ B = (A + B)·(A' + B')", Source: 'from the truth table (maxterms 0 and 3)' },
]

const MSI: Row[] = [
  { Component: 'Half adder', Outputs: 'C = X·Y, S = X ⊕ Y' },
  { Component: 'Full adder', Outputs: 'C = X·Y + (X ⊕ Y)·Z, S = X ⊕ Y ⊕ Z; S ready at 2t, C at 3t' },
  { Component: '4-bit ripple adder', Outputs: 'S4 at 8t, C5 at 9t (L17 p38)' },
  { Component: 'Decoder n to 2^n', Outputs: 'output i = minterm i (first variable on the MSB select); a 0-enable is drawn with a bubble' },
  { Component: 'Active-low decoder', Outputs: "output i = m_i' when enabled, all 1s when disabled" },
  { Component: 'Encoder 4 to 2', Outputs: 'D0 = F1 + F3, D1 = F2 + F3 (exactly one input high)' },
  { Component: 'Priority encoder', Outputs: 'highest-numbered input wins; V = 0 when no input is high' },
  { Component: '4:1 MUX', Outputs: "Y = I0·S1'S0' + I1·S1'S0 + I2·S1S0' + I3·S1S0" },
  { Component: 'Magnitude comparator', Outputs: 'x_i = A_i ⊙ B_i; (A=B) = x3x2x1x0; no cascade inputs in CS2100' },
]

const GRAY: Row[] = [
  { Variables: '3 (A on rows, BC on columns)', Layout: 'row 0: m0 m1 m3 m2; row 1: m4 m5 m7 m6' },
  { Variables: '4 (AB rows, CD columns: tutorials, answer keys)', Layout: 'rows 00, 01, 11, 10 hold m0 m1 m3 m2 / m4 m5 m7 m6 / m12 m13 m15 m14 / m8 m9 m11 m10' },
  { Variables: '4 (AB columns, CD rows: L15 p32 onwards, R07)', Layout: 'cell (row CD, column AB) holds m(4·AB + CD)' },
  { Variables: '5', Layout: "two 4-variable maps side by side: left V' (m0 to m15), right V (m16 to m31), stacked, not mirrored" },
]

const SECTIONS: { id: string; title: string; refs: string; body: ReactNode }[] = [
  { id: 'registers', title: 'Registers', refs: 'L08 p7', body: <DataTable compact columns={cols(['No', 'Name', 'Binary', 'Use'], { mono: ['No', 'Name', 'Binary'] })} rows={REGS} /> },
  {
    id: 'formats',
    title: 'Instruction formats and opcodes',
    refs: 'L08, green card',
    body: (
      <>
        <DataTable compact columns={cols(['Format', 'Fields', 'Bits'], { mono: ['Bits'] })} rows={FORMATS} />
        <DataTable compact columns={cols(['Instruction', 'Format', 'Opcode', 'Funct', 'Meaning'], { mono: ['Instruction', 'Opcode', 'Funct'] })} rows={INSTR} caption="Opcode and funct in hex" />
        <Callout kind="course" cite="L08 p28, p37 to p39">
          Branch immediate = (target − (PC + 4)) ÷ 4, signed 16 bits. Jump target field = target address bits 27 to 2;
          the CPU puts back PC+4[31:28] in front and 00 at the end.
        </Callout>
      </>
    ),
  },
  { id: 'pseudo', title: 'Pseudo-instructions', refs: 'L06 p34, L07 p29, T04 Q2', body: <DataTable compact columns={cols(['Pseudo', 'Expansion'], { mono: ['Pseudo', 'Expansion'] })} rows={PSEUDO} /> },
  {
    id: 'control',
    title: 'Main control',
    refs: 'L12 p26 to p34',
    body: (
      <>
        <DataTable compact columns={cols(['Instr', ...SIGNAL_KEYS], { mono: SIGNAL_KEYS, center: SIGNAL_KEYS })} rows={CONTROL} />
        <DataTable compact columns={cols(['Signal', 'v0', 'v1'], { headers: { v0: 'Value 0', v1: 'Value 1' } })} rows={SIGNALS} caption="What each value selects" />
        <Callout kind="trap">
          Write enables (RegWrite, MemWrite, MemRead, Branch) are always 0 or 1. Only mux selects (RegDst, MemToReg) can be X,
          when their output is not used.
        </Callout>
      </>
    ),
  },
  {
    id: 'alu',
    title: 'ALU control',
    refs: 'L11 p34, L12 p24 to p28',
    body: (
      <>
        <DataTable compact columns={cols(['Instr', 'ALUop', 'Funct', 'Action', 'ALUcontrol'], { mono: ['ALUop', 'Funct', 'ALUcontrol'] })} rows={ALU_CONTROL} />
        <DataTable compact columns={cols(['ALUcontrol', 'Function'], { mono: ['ALUcontrol'] })} rows={ALU_CODES} caption="4-bit codes: Ainvert, Binvert, Operation[1:0]" />
      </>
    ),
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    refs: 'L20, L21, R11',
    body: (
      <>
        <DataTable compact columns={cols(['Stage', 'Signals'])} rows={STAGE_CONTROL} caption="Where each control signal is used (L20 p27)" />
        <DataTable compact columns={cols(['Situation', 'Stall', 'Rule'])} rows={HAZARDS} caption="Stall rules used by the answer keys" />
        <DataTable compact columns={cols(['Design', 'Cycle', 'Time'], { headers: { Cycle: 'Cycle time', Time: 'Time for I instructions' } })} rows={TIMING} caption="L20 p31 to p33" />
      </>
    ),
  },
  {
    id: 'cache',
    title: 'Cache',
    refs: 'L22, L23, R12',
    body: (
      <>
        <DataTable compact columns={cols(['Quantity', 'Formula'])} rows={CACHE} />
        <DataTable compact columns={cols(['Type', 'When'])} rows={MISSES} caption="Miss types (L22 p53, R12 p21 to p25)" />
        <DataTable compact columns={cols(['Case', 'Effect'])} rows={WRITES} caption="Write policies (L22 p66 to p70)" />
      </>
    ),
  },
  {
    id: 'boolean',
    title: 'Boolean algebra',
    refs: 'L13, L14, L17',
    body: (
      <>
        <DataTable compact columns={cols(['Law', 'AND', 'OR'], { mono: ['AND', 'OR'], headers: { AND: 'AND form', OR: 'OR form' } })} rows={LAWS} />
        <DataTable compact columns={cols(['Identity', 'Source'], { mono: ['Identity'] })} rows={XOR} caption="XOR and XNOR" />
        <Callout kind="course" cite="L13 p9, T06 p2">
          Precedence: NOT, then AND, then OR. Always write the AND dot in answers.
        </Callout>
      </>
    ),
  },
  { id: 'kmap', title: 'K-map layouts', refs: 'L15', body: <DataTable compact columns={cols(['Variables', 'Layout'])} rows={GRAY} /> },
  { id: 'msi', title: 'Combinational and MSI', refs: 'L17, L18', body: <DataTable compact columns={cols(['Component', 'Outputs'])} rows={MSI} /> },
  {
    id: 'flipflops',
    title: 'Flip-flops',
    refs: 'L19 p18 to p45',
    body: (
      <>
        <DataTable compact columns={cols(['FF', 'Behaviour', 'Equation'], { mono: ['Equation'], headers: { FF: 'Flip-flop' } })} rows={FF_CHAR} caption="Characteristic tables (use for analysis)" />
        <DataTable
          compact
          columns={cols(['Q', 'JK', 'SR', 'D', 'T'], { mono: ['Q', 'JK', 'SR', 'D', 'T'], center: ['JK', 'SR', 'D', 'T'], headers: { Q: 'Q to Q+', JK: 'J K', SR: 'S R' } })}
          rows={FF_EXC}
          caption="Excitation tables (use for design)"
        />
      </>
    ),
  },
]

export default function ReferencePage() {
  return (
    <Workspace
      title="Reference tables"
      lectures="Every table you look up during practice, with the slides it comes from"
      inspector={
        <Panel title="On this page">
          <ul className="ref-toc">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="ref-toc-link"
                  onClick={() => document.getElementById(`ref-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {s.title}
                </button>
                <span className="ref-toc-refs">{s.refs}</span>
              </li>
            ))}
          </ul>
        </Panel>
      }
    >
      {SECTIONS.map((s) => (
        <section key={s.id} id={`ref-${s.id}`} className="ref-section">
          <Panel title={s.title} actions={<span className="ref-refs">{s.refs}</span>}>
            <div className="ref-body">{s.body}</div>
          </Panel>
        </section>
      ))}
    </Workspace>
  )
}
