/**
 * Hand-placed geometry of the L12 p30 single-cycle datapath with control (same topology as L11 p48,
 * scaled up so value labels fit). Wire ids match src/core/datapath/wires.ts.
 */

import type { UnitId } from '../../core/datapath'

export const VIEW = { w: 1000, h: 700 }

/** Orthogonal wire paths. Shared trunks are drawn once per wire; the most active one is painted last. */
export const WIRE_PATH: Record<string, string> = {
  'pc-im': 'M290 120H300V200H220',
  'pc-add4': 'M290 120H315V100H340',
  four: 'M330 140H340',
  'pc4-pcsrc': 'M390 120H880',
  'pc4-badd': 'M390 120H440V150H760',
  'inst-op': 'M90 290H278',
  'inst-rs': 'M90 375H330',
  'inst-rt-rr2': 'M90 410H330',
  'inst-rt-regdst': 'M90 410H230V470H265',
  'inst-rd': 'M90 510H265',
  'inst-imm': 'M90 580H345',
  'inst-funct': 'M90 625H591',
  rd1: 'M430 375H600',
  'rd2-alusrc': 'M430 450H515',
  'rd2-dm': 'M430 450H452V550H760',
  'sext-alusrc': 'M435 580H485V505H515',
  'sext-shift': 'M435 580H485V190H616',
  alub: 'M537 477H600',
  'shift-badd': 'M704 190H760',
  btarget: 'M810 170H880',
  'alu-dm': 'M660 460H760',
  'alu-mtr': 'M660 460H715V620H900V520H920',
  iszero: 'M660 400H690V245H820',
  nextpc: 'M902 150H925V30H235V120H250',
  'dm-mtr': 'M850 480H920',
  wr: 'M285 492H330',
  wd: 'M942 502H960V685H305V512H330',
  'c-regdst': 'M300 319V335H252V545H275V530',
  'c-regwrite': 'M355 322V350',
  'c-alusrc': 'M373 310H526V430',
  'c-aluop': 'M318 325V665H635V641',
  'c-memread': 'M377 274H735V605H805V585',
  'c-memwrite': 'M381 298H805V440',
  'c-memtoreg': 'M382 286H931V462',
  'c-branch': 'M360 261V229H820',
  'c-branchne': 'M345 256V214H815',
  'c-alucontrol': 'M635 609V516',
  'c-pcsrc': 'M852 237H891V200',
}

/** The instruction bus out of instruction memory, drawn with the same tone as the opcode wire. */
export const BUS_PATH = 'M100 150H90V625'

/** Junction dots and the wires that meet there. */
export const JUNCTIONS: { x: number; y: number; wires: string[] }[] = [
  { x: 300, y: 120, wires: ['pc-im', 'pc-add4'] },
  { x: 440, y: 120, wires: ['pc4-pcsrc', 'pc4-badd'] },
  { x: 230, y: 410, wires: ['inst-rt-rr2', 'inst-rt-regdst'] },
  { x: 452, y: 450, wires: ['rd2-alusrc', 'rd2-dm'] },
  { x: 485, y: 505, wires: ['sext-alusrc', 'sext-shift'] },
  { x: 715, y: 460, wires: ['alu-dm', 'alu-mtr'] },
  { x: 90, y: 290, wires: ['inst-op'] },
  { x: 90, y: 375, wires: ['inst-rs'] },
  { x: 90, y: 410, wires: ['inst-rt-rr2', 'inst-rt-regdst'] },
  { x: 90, y: 510, wires: ['inst-rd'] },
  { x: 90, y: 580, wires: ['inst-imm'] },
]

export type Anchor = 'start' | 'middle' | 'end'

/**
 * Value labels. Each label belongs to one or more wires carrying the same value and takes the most
 * active tone among them. `name` is a fixed field name drawn beside the value (instruction taps).
 */
export const LABELS: { id: string; wires: string[]; x: number; y: number; anchor: Anchor; name?: { x: number; text: string } }[] = [
  { id: 'pc', wires: ['pc-im', 'pc-add4'], x: 260, y: 195, anchor: 'middle' },
  { id: 'pc4', wires: ['pc4-pcsrc', 'pc4-badd'], x: 620, y: 114, anchor: 'middle' },
  { id: 'op', wires: ['inst-op'], x: 170, y: 286, anchor: 'start', name: { x: 96, text: 'Inst[31:26]' } },
  { id: 'rs', wires: ['inst-rs'], x: 170, y: 371, anchor: 'start', name: { x: 96, text: 'Inst[25:21]' } },
  { id: 'rt', wires: ['inst-rt-rr2', 'inst-rt-regdst'], x: 170, y: 406, anchor: 'start', name: { x: 96, text: 'Inst[20:16]' } },
  { id: 'rd', wires: ['inst-rd'], x: 170, y: 506, anchor: 'start', name: { x: 96, text: 'Inst[15:11]' } },
  { id: 'imm', wires: ['inst-imm'], x: 170, y: 576, anchor: 'start', name: { x: 96, text: 'Inst[15:0]' } },
  { id: 'funct', wires: ['inst-funct'], x: 170, y: 621, anchor: 'start', name: { x: 96, text: 'Inst[5:0]' } },
  { id: 'rd1', wires: ['rd1'], x: 562, y: 369, anchor: 'middle' },
  { id: 'rd2', wires: ['rd2-alusrc'], x: 478, y: 444, anchor: 'middle' },
  { id: 'wdata', wires: ['rd2-dm'], x: 592, y: 544, anchor: 'middle' },
  { id: 'sext', wires: ['sext-alusrc', 'sext-shift'], x: 466, y: 599, anchor: 'middle' },
  { id: 'alub', wires: ['alub'], x: 568, y: 471, anchor: 'middle' },
  { id: 'shift', wires: ['shift-badd'], x: 732, y: 184, anchor: 'middle' },
  { id: 'btarget', wires: ['btarget'], x: 845, y: 164, anchor: 'middle' },
  { id: 'aluout', wires: ['alu-dm'], x: 694, y: 454, anchor: 'middle' },
  { id: 'alumtr', wires: ['alu-mtr'], x: 800, y: 614, anchor: 'middle' },
  { id: 'iszero', wires: ['iszero'], x: 695, y: 330, anchor: 'start' },
  { id: 'nextpc', wires: ['nextpc'], x: 580, y: 24, anchor: 'middle' },
  { id: 'rdata', wires: ['dm-mtr'], x: 885, y: 474, anchor: 'middle' },
  { id: 'wr', wires: ['wr'], x: 307, y: 484, anchor: 'middle' },
  { id: 'wd', wires: ['wd'], x: 620, y: 679, anchor: 'middle' },
]

/** Control-wire labels ("RegDst = 1"), placed along each line. */
export const CONTROL_LABELS: { wire: string; x: number; y: number; anchor: Anchor; name: string }[] = [
  { wire: 'c-branchne', x: 395, y: 210, anchor: 'start', name: 'BranchNE' },
  { wire: 'c-branch', x: 395, y: 225, anchor: 'start', name: 'Branch' },
  { wire: 'c-memread', x: 395, y: 271, anchor: 'start', name: 'MemRead' },
  { wire: 'c-memtoreg', x: 395, y: 283, anchor: 'start', name: 'MemToReg' },
  { wire: 'c-memwrite', x: 395, y: 295, anchor: 'start', name: 'MemWrite' },
  { wire: 'c-alusrc', x: 395, y: 307, anchor: 'start', name: 'ALUSrc' },
  { wire: 'c-regwrite', x: 360, y: 344, anchor: 'start', name: 'RegWrite' },
  { wire: 'c-regdst', x: 248, y: 352, anchor: 'end', name: 'RegDst' },
  { wire: 'c-aluop', x: 470, y: 659, anchor: 'middle', name: 'ALUop' },
  { wire: 'c-alucontrol', x: 641, y: 580, anchor: 'start', name: 'ALUcontrol' },
  { wire: 'c-pcsrc', x: 856, y: 252, anchor: 'start', name: 'PCSrc' },
]

export type MuxId = 'regdst' | 'alusrc' | 'memtoreg' | 'pcsrc'

/** Muxes: input y positions by input number, output point, and the select entry. MemToReg has 1 on top (L12 p15). */
export const MUXES: Record<MuxId, { x: number; y: number; h: number; inputs: Record<0 | 1, number>; out: number; name: { x: number; y: number } }> = {
  pcsrc: { x: 880, y: 100, h: 100, inputs: { 0: 120, 1: 170 }, out: 150, name: { x: 891, y: 94 } },
  regdst: { x: 265, y: 455, h: 75, inputs: { 0: 470, 1: 510 }, out: 492, name: { x: 275, y: 449 } },
  alusrc: { x: 515, y: 430, h: 100, inputs: { 0: 450, 1: 505 }, out: 477, name: { x: 526, y: 543 } },
  memtoreg: { x: 920, y: 462, h: 80, inputs: { 1: 480, 0: 520 }, out: 502, name: { x: 931, y: 556 } },
}
export const MUX_W = 22

const adder = (x: number, y: number, w: number, h: number) =>
  [[x, y], [x + w, y + h * 0.25], [x + w, y + h * 0.75], [x, y + h], [x, y + h * 0.6], [x + w * 0.22, y + h * 0.5], [x, y + h * 0.4]].map((p) => p.join(',')).join(' ')

export type UnitShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'poly'; points: string }
  | { kind: 'path'; d: string }
  | { kind: 'mux'; mux: MuxId }

export interface UnitGeom {
  shape: UnitShape
  /** Bounding box for the click target and the timing badge. */
  box: { x: number; y: number; w: number; h: number }
  /** Name lines drawn inside or beside the unit. */
  text: { x: number; y: number; lines: string[]; anchor?: Anchor; small?: boolean }
  /** Port names drawn inside the unit. */
  ports?: { x: number; y: number; text: string; anchor?: Anchor }[]
  /** Control-logic units take the control colour when active. */
  control?: boolean
  /** Where the timing badge sits (above the box by default). */
  badge?: { x: number; y: number; anchor?: Anchor }
}

const muxBox = (m: MuxId) => ({ x: MUXES[m].x, y: MUXES[m].y, w: MUX_W, h: MUXES[m].h })

export const UNIT_GEOM: Record<UnitId, UnitGeom> = {
  pc: { shape: { kind: 'rect', x: 250, y: 90, w: 40, h: 60 }, box: { x: 250, y: 90, w: 40, h: 60 }, text: { x: 270, y: 124, lines: ['PC'] } },
  im: {
    shape: { kind: 'rect', x: 100, y: 80, w: 120, h: 140 },
    box: { x: 100, y: 80, w: 120, h: 140 },
    text: { x: 160, y: 110, lines: ['Instruction', 'memory'] },
    ports: [{ x: 216, y: 203, text: 'Address', anchor: 'end' }, { x: 104, y: 146, text: 'Instruction', anchor: 'start' }],
  },
  add4: { shape: { kind: 'poly', points: adder(340, 80, 50, 80) }, box: { x: 340, y: 80, w: 50, h: 80 }, text: { x: 372, y: 124, lines: ['Add'], small: true } },
  control: { shape: { kind: 'ellipse', cx: 330, cy: 290, rx: 52, ry: 36 }, box: { x: 278, y: 254, w: 104, h: 72 }, text: { x: 330, y: 294, lines: ['Control'] }, control: true, badge: { x: 270, y: 262, anchor: 'end' } },
  rf: {
    shape: { kind: 'rect', x: 330, y: 350, w: 100, h: 175 },
    box: { x: 330, y: 350, w: 100, h: 175 },
    text: { x: 380, y: 430, lines: ['Register', 'file'] },
    ports: [
      { x: 334, y: 378, text: 'RR1' }, { x: 334, y: 413, text: 'RR2' }, { x: 334, y: 495, text: 'WR' }, { x: 334, y: 515, text: 'WD' },
      { x: 426, y: 378, text: 'RD1', anchor: 'end' }, { x: 426, y: 453, text: 'RD2', anchor: 'end' },
    ],
    badge: { x: 380, y: 540 },
  },
  regdst: { shape: { kind: 'mux', mux: 'regdst' }, box: muxBox('regdst'), text: { x: 275, y: 449, lines: ['RegDst'], small: true }, badge: { x: 262, y: 545, anchor: 'end' } },
  sext: { shape: { kind: 'ellipse', cx: 390, cy: 580, rx: 45, ry: 18 }, box: { x: 345, y: 562, w: 90, h: 36 }, text: { x: 390, y: 584, lines: ['Sign extend'], small: true }, badge: { x: 390, y: 612 } },
  alusrc: { shape: { kind: 'mux', mux: 'alusrc' }, box: muxBox('alusrc'), text: { x: 526, y: 543, lines: ['ALUSrc'], small: true }, badge: { x: 548, y: 424, anchor: 'start' } },
  aluctl: { shape: { kind: 'ellipse', cx: 635, cy: 625, rx: 44, ry: 16 }, box: { x: 591, y: 609, w: 88, h: 32 }, text: { x: 635, y: 629, lines: ['ALU control'], small: true }, control: true, badge: { x: 690, y: 632, anchor: 'start' } },
  alu: {
    shape: { kind: 'poly', points: '600,345 660,395 660,495 600,545 600,465 613,445 600,425' },
    box: { x: 600, y: 345, w: 60, h: 200 },
    text: { x: 636, y: 436, lines: ['ALU'] },
    ports: [{ x: 656, y: 404, text: 'isZero', anchor: 'end' }, { x: 656, y: 464, text: 'result', anchor: 'end' }],
    badge: { x: 630, y: 338 },
  },
  shift: { shape: { kind: 'ellipse', cx: 660, cy: 190, rx: 44, ry: 15 }, box: { x: 616, y: 175, w: 88, h: 30 }, text: { x: 660, y: 194, lines: ['Left shift 2'], small: true }, badge: { x: 660, y: 170 } },
  badd: { shape: { kind: 'poly', points: adder(760, 130, 50, 80) }, box: { x: 760, y: 130, w: 50, h: 80 }, text: { x: 792, y: 174, lines: ['Add'], small: true } },
  and: { shape: { kind: 'path', d: 'M820 220H836A17 17 0 0 1 836 254H820Z' }, box: { x: 820, y: 220, w: 33, h: 34 }, text: { x: 834, y: 241, lines: ['AND'], small: true }, control: true, badge: { x: 836, y: 268 } },
  pcsrc: { shape: { kind: 'mux', mux: 'pcsrc' }, box: muxBox('pcsrc'), text: { x: 891, y: 94, lines: ['PCSrc'], small: true }, badge: { x: 908, y: 210, anchor: 'start' } },
  dm: {
    shape: { kind: 'rect', x: 760, y: 440, w: 90, h: 145 },
    box: { x: 760, y: 440, w: 90, h: 145 },
    text: { x: 805, y: 508, lines: ['Data', 'memory'] },
    ports: [{ x: 764, y: 463, text: 'Address' }, { x: 764, y: 553, text: 'Write data' }, { x: 846, y: 476, text: 'Read data', anchor: 'end' }],
    badge: { x: 805, y: 434 },
  },
  memtoreg: { shape: { kind: 'mux', mux: 'memtoreg' }, box: muxBox('memtoreg'), text: { x: 931, y: 556, lines: ['MemToReg'], small: true }, badge: { x: 931, y: 454 } },
}

/** Draw order of units (no overlap, but keeps focus order roughly left to right). */
export const UNIT_ORDER: UnitId[] = ['pc', 'im', 'add4', 'control', 'rf', 'regdst', 'sext', 'alusrc', 'alu', 'aluctl', 'shift', 'badd', 'and', 'pcsrc', 'dm', 'memtoreg']
