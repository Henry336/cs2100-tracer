import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Every module in the app. Order and groups follow the course: programs, the processor,
 * memory, then digital logic. `lectures` is shown in the rail and on the module page.
 */
export interface ModuleDef {
  id: string
  path: string
  title: string
  /** One plain sentence: what you can do here. */
  blurb: string
  lectures: string
  group: 'Programs' | 'Processor' | 'Memory' | 'Logic' | 'Reference'
  component: LazyExoticComponent<ComponentType>
}

export const MODULES: ModuleDef[] = [
  {
    id: 'c-memory',
    path: '/c-memory',
    title: 'C memory and pointers',
    blurb: 'Trace small C programs as boxes and arrows: pointers, pass-by-value, arrays and structs in memory.',
    lectures: 'L02 to L05',
    group: 'Programs',
    component: lazy(() => import('./c-memory/CMemoryPage')),
  },
  {
    id: 'mips',
    path: '/mips',
    title: 'MIPS',
    blurb: 'Run MIPS step by step, and encode or decode any instruction field by field.',
    lectures: 'L06 to L10',
    group: 'Programs',
    component: lazy(() => import('./mips/MipsPage')),
  },
  {
    id: 'datapath',
    path: '/datapath',
    title: 'Datapath and control',
    blurb: 'Watch one instruction light up the single-cycle datapath, with every control signal and wire value.',
    lectures: 'L11 to L12',
    group: 'Processor',
    component: lazy(() => import('./datapath/DatapathPage')),
  },
  {
    id: 'pipeline',
    path: '/pipeline',
    title: 'Pipeline',
    blurb: 'Cycle-by-cycle pipeline diagrams with stalls, forwarding and branch handling, plus the pipelined datapath.',
    lectures: 'L20 to L21',
    group: 'Processor',
    component: lazy(() => import('./pipeline/PipelinePage')),
  },
  {
    id: 'cache',
    path: '/cache',
    title: 'Cache',
    blurb: 'Feed addresses through direct-mapped, set-associative or fully associative caches and watch every hit, miss and write.',
    lectures: 'L22 to L23',
    group: 'Memory',
    component: lazy(() => import('./cache/CachePage')),
  },
  {
    id: 'boolean',
    path: '/boolean',
    title: 'Boolean algebra and K-maps',
    blurb: 'Truth tables, minterms and K-maps with every prime implicant drawn and the minimal SOP and POS.',
    lectures: 'L13 to L16',
    group: 'Logic',
    component: lazy(() => import('./boolean/BooleanPage')),
  },
  {
    id: 'msi',
    path: '/msi',
    title: 'Combinational and MSI',
    blurb: 'Adders, comparators, decoders, encoders and multiplexers, with function implementation checks.',
    lectures: 'L17 to L18',
    group: 'Logic',
    component: lazy(() => import('./msi/MsiPage')),
  },
  {
    id: 'sequential',
    path: '/sequential',
    title: 'Sequential circuits',
    blurb: 'Flip-flops, state tables and diagrams, analysis and design, unused states and self-correction.',
    lectures: 'L19',
    group: 'Logic',
    component: lazy(() => import('./sequential/SequentialPage')),
  },
  {
    id: 'reference',
    path: '/reference',
    title: 'Reference tables',
    blurb: 'Every table you look up during practice: control signals, ALU control, excitation tables, cache formulas, registers.',
    lectures: 'All',
    group: 'Reference',
    component: lazy(() => import('./reference/ReferencePage')),
  },
]

export const GROUPS: ModuleDef['group'][] = ['Programs', 'Processor', 'Memory', 'Logic', 'Reference']
