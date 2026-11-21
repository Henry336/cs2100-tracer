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
    blurb: 'Step through small C programs and watch variables, pointers and arrays in memory.',
    lectures: 'L02 to L05',
    group: 'Programs',
    component: lazy(() => import('./c-memory/CMemoryPage')),
  },
  {
    id: 'mips',
    path: '/mips',
    title: 'MIPS',
    blurb: 'Run MIPS one instruction at a time, or encode and decode an instruction.',
    lectures: 'L06 to L10',
    group: 'Programs',
    component: lazy(() => import('./mips/MipsPage')),
  },
  {
    id: 'datapath',
    path: '/datapath',
    title: 'Datapath and control',
    blurb: 'Watch one instruction move through the single-cycle datapath.',
    lectures: 'L11 to L12',
    group: 'Processor',
    component: lazy(() => import('./datapath/DatapathPage')),
  },
  {
    id: 'pipeline',
    path: '/pipeline',
    title: 'Pipeline',
    blurb: 'See the pipeline cycle by cycle, with its stalls, forwarding and branches.',
    lectures: 'L20 to L21',
    group: 'Processor',
    component: lazy(() => import('./pipeline/PipelinePage')),
  },
  {
    id: 'cache',
    path: '/cache',
    title: 'Cache',
    blurb: 'Send addresses through a cache and see each hit, miss and write.',
    lectures: 'L22 to L23',
    group: 'Memory',
    component: lazy(() => import('./cache/CachePage')),
  },
  {
    id: 'boolean',
    path: '/boolean',
    title: 'Boolean algebra and K-maps',
    blurb: 'Simplify a function with a K-map and find its prime implicants.',
    lectures: 'L13 to L16',
    group: 'Logic',
    component: lazy(() => import('./boolean/BooleanPage')),
  },
  {
    id: 'msi',
    path: '/msi',
    title: 'Combinational and MSI',
    blurb: 'Decoders, encoders, multiplexers, comparators and adders.',
    lectures: 'L17 to L18',
    group: 'Logic',
    component: lazy(() => import('./msi/MsiPage')),
  },
  {
    id: 'sequential',
    path: '/sequential',
    title: 'Sequential circuits',
    blurb: 'Flip-flops, state tables and state diagrams.',
    lectures: 'L19',
    group: 'Logic',
    component: lazy(() => import('./sequential/SequentialPage')),
  },
  {
    id: 'reference',
    path: '/reference',
    title: 'Reference tables',
    blurb: 'The course tables in one place.',
    lectures: 'All',
    group: 'Reference',
    component: lazy(() => import('./reference/ReferencePage')),
  },
  {
    id: 'papers',
    path: '/papers',
    title: 'Past papers',
    blurb: 'Pick a past exam question and open it in the right tracer, ready to step through.',
    lectures: 'Finals AY15/16 to AY25/26',
    group: 'Reference',
    component: lazy(() => import('./papers/PapersPage')),
  },
]

export const GROUPS: ModuleDef['group'][] = ['Programs', 'Processor', 'Memory', 'Logic', 'Reference']
