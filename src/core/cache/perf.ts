import { clean } from './format'
import type { Explain, Geometry, Result } from './types'

/**
 * Average access time (L22 p20-21): h × hit time + (1 - h) × miss penalty.
 * With `memoryTime` the penalty is memory time + hit time, as L22 p21 does (10 + 0.8).
 * Give `hitRate` to get the average, or `target` to solve for the hit rate.
 */
export function averageAccessTime(p: {
  hitTime: number
  missPenalty?: number
  memoryTime?: number
  hitRate?: number
  target?: number
}): Result<{ missPenalty: number; hitRate: number; average: number; why: { penalty: Explain; result: Explain } }> {
  const { hitTime } = p
  if (!(hitTime >= 0)) return { ok: false, errors: ['Hit time must be 0 or more.'] }
  if (p.missPenalty === undefined && p.memoryTime === undefined) return { ok: false, errors: ['Give the miss penalty or the memory access time.'] }
  if (p.missPenalty === undefined && !((p.memoryTime ?? 0) > 0)) return { ok: false, errors: ['Memory access time must be more than 0.'] }
  const missPenalty = p.missPenalty ?? clean((p.memoryTime ?? 0) + hitTime)
  if (!(missPenalty > hitTime)) {
    return { ok: false, errors: [`The miss penalty (${missPenalty}) must be more than the hit time (${hitTime}), since it includes the hit time (L22 p20).`] }
  }
  const penalty: Explain =
    p.missPenalty !== undefined
      ? { rule: 'Miss penalty as given (it already includes the hit time).', working: `${missPenalty}`, cite: 'L22 p20' }
      : { rule: 'Miss penalty = time to replace the block from memory + hit time.', working: `${p.memoryTime} + ${hitTime} = ${missPenalty}`, cite: 'L22 p20-21' }
  if (p.hitRate !== undefined) {
    const h = p.hitRate
    if (!(h >= 0 && h <= 1)) return { ok: false, errors: ['Hit rate must be between 0 and 1.'] }
    const average = clean(h * hitTime + (1 - h) * missPenalty)
    return {
      ok: true,
      value: {
        missPenalty,
        hitRate: h,
        average,
        why: {
          penalty,
          result: {
            rule: 'Average access time = hit rate × hit time + (1 - hit rate) × miss penalty.',
            working: `${h} × ${hitTime} + ${clean(1 - h)} × ${missPenalty} = ${average}`,
            cite: 'L22 p21',
          },
        },
      },
    }
  }
  if (p.target === undefined) return { ok: false, errors: ['Give a hit rate, or a target average access time to solve for the hit rate.'] }
  const h = clean((missPenalty - p.target) / (missPenalty - hitTime))
  if (!(h >= 0 && h <= 1)) {
    return { ok: false, errors: [`A target of ${p.target} cannot be reached: it must lie between the hit time ${hitTime} and the miss penalty ${missPenalty}.`] }
  }
  return {
    ok: true,
    value: {
      missPenalty,
      hitRate: h,
      average: p.target,
      why: {
        penalty,
        result: {
          rule: 'Solve target = h × hit time + (1 - h) × miss penalty for h.',
          working: `${p.target} = ${hitTime}h + ${missPenalty}(1 - h), so h = (${missPenalty} - ${p.target}) / (${missPenalty} - ${hitTime}) = ${h}`,
          cite: 'L22 p21',
        },
      },
    },
  }
}

/** Total SRAM bits: data + tag + valid (+ dirty for write-back), per line × lines (L22 p28, p68). */
export function storageBits(g: Geometry, includeDirty: boolean) {
  const data = g.config.blockBytes * 8
  const dirty = includeDirty ? 1 : 0
  const perLine = data + g.tagBits + 1 + dirty
  const totalBits = perLine * g.blocks
  return {
    perLine: { data, tag: g.tagBits, valid: 1, dirty, total: perLine },
    lines: g.blocks,
    dataBits: data * g.blocks,
    tagBits: g.tagBits * g.blocks,
    tagBitsPerSet: g.tagBits * g.ways,
    overheadBits: (g.tagBits + 1 + dirty) * g.blocks,
    totalBits,
    why: {
      perLine: {
        rule: `Each line holds the data block, its tag and a valid bit${includeDirty ? ', plus a dirty bit for write-back' : ''}.`,
        working: `${data} + ${g.tagBits} + 1${includeDirty ? ' + 1' : ''} = ${perLine} bits`,
        cite: includeDirty ? 'L22 p28, p68' : 'L22 p28',
      },
      total: { rule: 'Total = bits per line × number of lines.', working: `${perLine} × ${g.blocks} = ${totalBits} bits`, cite: 'L22 p28' },
      tagBitsPerSet: {
        rule: 'Tag bits per set = tag width × ways.',
        working: `${g.tagBits} × ${g.ways} = ${g.tagBits * g.ways}`,
      },
    } satisfies Record<string, Explain>,
  }
}

/**
 * Exam model for a 5-stage pipeline whose memory sends one word at a time (R12 p44-48).
 * Penalty = words per block × cycles per word (+1 if the restart counts).
 * lw miss = stages + words × t either way: 5 + 40 = 45 (AY24/25), 4 + 21 = 25 (AY25/26).
 */
export function pipelineCacheModel(p: {
  blockBytes: number
  wordBytes?: number
  cyclesPerWord: number
  restart: boolean
  hitRate: number
  dataFraction: number
  instructions: number
  stages?: number
  hitTime?: number
}): Result<{
  words: number
  missPenalty: number
  lwHit: number
  lwMiss: number
  beq: number
  dataAccesses: number
  cyclesLost: number
  dataAccessCycles: number
  why: Record<'words' | 'missPenalty' | 'lwHit' | 'lwMiss' | 'beq' | 'cyclesLost' | 'dataAccessCycles', Explain>
  notes: string[]
}> {
  const wordBytes = p.wordBytes ?? 4
  const stages = p.stages ?? 5
  const hitTime = p.hitTime ?? 1
  const errors: string[] = []
  if (!(p.blockBytes > 0) || p.blockBytes % wordBytes !== 0) errors.push('Block size must be a whole number of words.')
  if (!(p.hitRate >= 0 && p.hitRate <= 1)) errors.push('Hit rate must be between 0 and 1.')
  if (!(p.dataFraction >= 0 && p.dataFraction <= 1)) errors.push('Data access fraction must be between 0 and 1.')
  if (!(p.cyclesPerWord >= 0) || !(p.instructions >= 0)) errors.push('Cycles per word and instruction count must be 0 or more.')
  if (errors.length) return { ok: false, errors }

  const words = p.blockBytes / wordBytes
  const transfer = words * p.cyclesPerWord
  const missPenalty = transfer + (p.restart ? 1 : 0)
  const lwMiss = stages + transfer
  const missRate = clean(1 - p.hitRate)
  const dataAccesses = clean(p.instructions * p.dataFraction)
  const cyclesLost = clean(dataAccesses * missRate * missPenalty)
  const dataAccessCycles = clean(dataAccesses * (p.hitRate * hitTime + missRate * missPenalty))
  return {
    ok: true,
    value: {
      words,
      missPenalty,
      lwHit: stages,
      lwMiss,
      beq: stages,
      dataAccesses,
      cyclesLost,
      dataAccessCycles,
      why: {
        words: { rule: 'Memory sends one word at a time, so a block needs block size / word size transfers.', working: `${p.blockBytes} / ${wordBytes} = ${words}`, cite: 'R12 p44' },
        missPenalty: p.restart
          ? { rule: 'Miss penalty = words × cycles per word + 1 for restarting the instruction.', working: `${words} × ${p.cyclesPerWord} + 1 = ${missPenalty}`, cite: 'R12 p48 (AY25/26 Q20)' }
          : { rule: 'Miss penalty = words × cycles per word.', working: `${words} × ${p.cyclesPerWord} = ${missPenalty}`, cite: 'R12 p44 (AY24/25 Q20; key also accepts +1)' },
        lwHit: { rule: `On a hit every stage takes 1 cycle, MEM included, so lw takes ${stages} cycles.`, working: `${stages}`, cite: 'R12 p44, p48' },
        lwMiss: p.restart
          ? { rule: 'lw miss = the stages other than MEM + the miss penalty (which already counts the restart).', working: `${stages - 1} + ${missPenalty} = ${lwMiss}`, cite: 'R12 p48' }
          : { rule: 'lw miss = all stages + the block transfer time.', working: `${stages} + ${transfer} = ${lwMiss}`, cite: 'R12 p44' },
        beq: { rule: 'beq never touches data memory, so a data-cache miss cannot slow it.', working: `${stages}`, cite: 'R12 p48' },
        cyclesLost: {
          rule: 'Cycles lost = instructions × data access fraction × miss rate × miss penalty.',
          working: `${p.instructions} × ${p.dataFraction} × ${missRate} × ${missPenalty} = ${cyclesLost}`,
          cite: 'R12 p45',
        },
        dataAccessCycles: {
          rule: 'Total data access time = data accesses × (hit rate × hit time + miss rate × miss penalty).',
          working: `${dataAccesses} × (${p.hitRate} × ${hitTime} + ${missRate} × ${missPenalty}) = ${dataAccessCycles}`,
          cite: 'L22 p21 (AY24/25 Q20 key also accepts a total of 95 or 96)',
        },
      },
      notes: [
        'Cache size and associativity do not enter the miss penalty; only block size and transfer time do (AY25/26 Q20(e) is false).',
        'Counted in cycles, a faster CPU makes each memory word cost more cycles, so lost cycles do not drop (AY24/25 Q20(e) is false).',
        'Keys differ on the restart cycle. AY24/25 Q20 takes lw miss = penalty + 5 (45, or 46 with a 41-cycle penalty) and accepts a total of 95 or 96. R12 p48 and AY25/26 Q20 take lw miss = 4 + penalty. The app follows R12 when the restart is counted.',
      ],
    },
  }
}
