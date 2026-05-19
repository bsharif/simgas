import { useState, useRef, type FC } from 'react'
import { useSimulation } from '../context/SimulationContext'
import { assembleMarkdown } from '../../engine/scenarios/dsl/assemble'
import { parseScenarioFile } from '../../engine/scenarios/dsl/parse'
import type { ScenarioSpec, Snap, Baseline } from '../../engine/scenarios/dsl/schema'

// ── form state types ──────────────────────────────────────────────────────────

interface SnapForm {
  hr: string; spo2: string; etco2: string; rr: string; temp: string
  nibp_sys: string; nibp_dia: string
  ecgRhythm: '' | 'sinus' | 'vf' | 'vt' | 'asystole' | 'svt'
  tubePosition: '' | 'none' | 'trachea' | 'oesophagus'
  fio2: string; sevoflurane: string
}

interface BaselineForm {
  hr: string; spo2: string; etco2: string; rr: string; temp: string
  nibp_sys: string; nibp_dia: string
}

type ConditionSubject =
  | 'time' | 'phase_elapsed'
  | 'hr' | 'spo2' | 'etco2' | 'rr' | 'temp'
  | 'tube_position'
  | 'intervention_given' | 'intervention_not_given' | 'intervention_count'
  | 'phase_done'

type ConditionOp = '>' | '<' | '>=' | '<=' | '==' | '!='

interface ConditionRow {
  key: string
  subject: ConditionSubject | ''
  op: ConditionOp | ''
  value: string
  refId: string
}

interface ConditionField {
  mode: 'builder' | 'raw'
  rows: ConditionRow[]
  join: 'AND' | 'OR'
  raw: string
}

interface PhaseForm {
  id: string
  enter_when: ConditionField
  baseline: BaselineForm
  events: Array<{ at: string; text: string }>
  resolve_when: ConditionField
  resolve_snap: SnapForm
  fail_when: ConditionField
  fail_snap: SnapForm
  hints_if_missing: Array<{ id: string; hint: string }>
}

interface CreatorState {
  id: string; label: string; description: string
  difficulty: 'easy' | 'medium' | 'hard'
  hints: string[]
  initial_state: SnapForm
  initial_baseline: BaselineForm
  phases: PhaseForm[]
  debriefBody: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

function baselineFormToSpec(f: BaselineForm): Baseline | undefined {
  const obj: Baseline = {}
  const hr = parseNum(f.hr); if (hr !== undefined) obj.hr = hr
  const spo2 = parseNum(f.spo2); if (spo2 !== undefined) obj.spo2 = spo2
  const etco2 = parseNum(f.etco2); if (etco2 !== undefined) obj.etco2 = etco2
  const rr = parseNum(f.rr); if (rr !== undefined) obj.rr = rr
  const temp = parseNum(f.temp); if (temp !== undefined) obj.temp = temp
  const sys = parseNum(f.nibp_sys); const dia = parseNum(f.nibp_dia)
  if (sys !== undefined || dia !== undefined) obj.nibp = { sys, dia }
  return Object.keys(obj).length > 0 ? obj : undefined
}

function snapFormToSpec(f: SnapForm): Snap | undefined {
  const base = baselineFormToSpec(f)
  const obj: Snap = base ? { ...base } : {}
  if (f.ecgRhythm) obj.ecgRhythm = f.ecgRhythm
  if (f.tubePosition) obj.tubePosition = f.tubePosition
  const fio2 = parseNum(f.fio2); if (fio2 !== undefined) obj.fio2 = fio2
  const sevo = parseNum(f.sevoflurane); if (sevo !== undefined) obj.sevoflurane = sevo
  return Object.keys(obj).length > 0 ? obj : undefined
}

// ── condition field helpers ───────────────────────────────────────────────────

const NUMERIC_SUBJECTS = new Set([
  'time', 'phase_elapsed', 'hr', 'spo2', 'etco2', 'rr', 'temp',
])

const OP_LABELS: Record<string, string> = {
  '>': 'is more than',
  '<': 'is less than',
  '>=': 'is at least',
  '<=': 'is at most',
  '==': 'equals',
  '!=': 'does not equal',
}

const REF_SUBJECTS = new Set(['intervention_given', 'intervention_not_given', 'intervention_count', 'phase_done'])

function emptyRow(): ConditionRow {
  return { key: String(Math.random()), subject: '', op: '', value: '', refId: '' }
}

function emptyConditionField(): ConditionField {
  return { mode: 'builder', rows: [], join: 'AND', raw: '' }
}

function conditionRowToStr(row: ConditionRow): string {
  switch (row.subject) {
    case 'time': case 'phase_elapsed':
    case 'hr': case 'spo2': case 'etco2': case 'rr': case 'temp':
      if (!row.op || !row.value) return ''
      return `${row.subject} ${row.op} ${row.value}`
    case 'tube_position':
      if (!row.op || !row.value) return ''
      return `tube_position ${row.op} '${row.value}'`
    case 'intervention_given':
      if (!row.refId) return ''
      return `any('${row.refId}')`
    case 'intervention_not_given':
      if (!row.refId) return ''
      return `!any('${row.refId}')`
    case 'intervention_count':
      if (!row.refId || !row.op || !row.value) return ''
      return `count('${row.refId}') ${row.op} ${row.value}`
    case 'phase_done':
      if (!row.refId) return ''
      return `phase_done('${row.refId}')`
    default: return ''
  }
}

function conditionFieldToStr(f: ConditionField): string | undefined {
  if (f.mode === 'raw') return f.raw.trim() || undefined
  const parts = f.rows.map(conditionRowToStr).filter(Boolean)
  if (!parts.length) return undefined
  return parts.join(f.join === 'AND' ? ' && ' : ' || ')
}

function parseConditionPart(part: string): ConditionRow | null {
  const key = String(Math.random())
  const anyM = part.match(/^any\('([^']+)'\)$/)
  if (anyM) return { key, subject: 'intervention_given', op: '', value: '', refId: anyM[1] }
  const notAnyM = part.match(/^!any\('([^']+)'\)$/)
  if (notAnyM) return { key, subject: 'intervention_not_given', op: '', value: '', refId: notAnyM[1] }
  const countM = part.match(/^count\('([^']+)'\)\s*(>=|<=|==|!=|>|<)\s*(\d+(?:\.\d+)?)$/)
  if (countM) return { key, subject: 'intervention_count', op: countM[2] as ConditionOp, value: countM[3], refId: countM[1] }
  const phaseM = part.match(/^phase_done\('([^']+)'\)$/)
  if (phaseM) return { key, subject: 'phase_done', op: '', value: '', refId: phaseM[1] }
  const tubeM = part.match(/^tube_position\s*(==|!=)\s*'([^']+)'$/)
  if (tubeM) return { key, subject: 'tube_position', op: tubeM[1] as ConditionOp, value: tubeM[2], refId: '' }
  const numM = part.match(/^(time|phase_elapsed|hr|spo2|etco2|rr|temp)\s*(>=|<=|==|!=|>|<)\s*(\d+(?:\.\d+)?)$/)
  if (numM) return { key, subject: numM[1] as ConditionSubject, op: numM[2] as ConditionOp, value: numM[3], refId: '' }
  return null
}

function parseConditionStr(str: string | undefined): ConditionField {
  if (!str) return emptyConditionField()
  const hasAnd = str.includes(' && ')
  const hasOr = str.includes(' || ')
  if (hasAnd && hasOr) return { mode: 'raw', rows: [], join: 'AND', raw: str }
  const join: 'AND' | 'OR' = hasOr ? 'OR' : 'AND'
  const parts = hasAnd ? str.split(' && ') : hasOr ? str.split(' || ') : [str]
  const rows: ConditionRow[] = []
  for (const p of parts) {
    const row = parseConditionPart(p.trim())
    if (!row) return { mode: 'raw', rows: [], join: 'AND', raw: str }
    rows.push(row)
  }
  return { mode: 'builder', rows, join, raw: str }
}

function creatorStateToSpec(s: CreatorState): ScenarioSpec {
  return {
    id: s.id.trim() || 'untitled',
    label: s.label.trim() || 'Untitled',
    description: s.description.trim(),
    difficulty: s.difficulty,
    hints: s.hints.filter(Boolean),
    initial_state: snapFormToSpec(s.initial_state),
    initial_baseline: baselineFormToSpec(s.initial_baseline),
    phases: s.phases.map(p => ({
      id: p.id.trim() || 'phase',
      enter_when: conditionFieldToStr(p.enter_when),
      baseline: baselineFormToSpec(p.baseline),
      events: p.events.filter(e => e.at && e.text),
      resolve_when: conditionFieldToStr(p.resolve_when),
      resolve_snap: snapFormToSpec(p.resolve_snap),
      resolve_events: [],
      fail_when: conditionFieldToStr(p.fail_when),
      fail_snap: snapFormToSpec(p.fail_snap),
      fail_events: [],
      hints_if_missing: Object.fromEntries(
        p.hints_if_missing.filter(h => h.id && h.hint).map(h => [h.id, h.hint])
      ),
    })),
  }
}

function snapToForm(snap?: Snap): SnapForm {
  return {
    hr: snap?.hr?.toString() ?? '', spo2: snap?.spo2?.toString() ?? '',
    etco2: snap?.etco2?.toString() ?? '', rr: snap?.rr?.toString() ?? '',
    temp: snap?.temp?.toString() ?? '',
    nibp_sys: snap?.nibp?.sys?.toString() ?? '', nibp_dia: snap?.nibp?.dia?.toString() ?? '',
    ecgRhythm: (snap?.ecgRhythm ?? '') as SnapForm['ecgRhythm'],
    tubePosition: (snap?.tubePosition ?? '') as SnapForm['tubePosition'],
    fio2: snap?.fio2?.toString() ?? '', sevoflurane: snap?.sevoflurane?.toString() ?? '',
  }
}

function baselineToForm(b?: Baseline): BaselineForm {
  return {
    hr: b?.hr?.toString() ?? '', spo2: b?.spo2?.toString() ?? '',
    etco2: b?.etco2?.toString() ?? '', rr: b?.rr?.toString() ?? '',
    temp: b?.temp?.toString() ?? '',
    nibp_sys: b?.nibp?.sys?.toString() ?? '', nibp_dia: b?.nibp?.dia?.toString() ?? '',
  }
}

function specToCreatorState(spec: ScenarioSpec, body: string): CreatorState {
  return {
    id: spec.id, label: spec.label, description: spec.description,
    difficulty: spec.difficulty, hints: [...spec.hints],
    initial_state: snapToForm(spec.initial_state),
    initial_baseline: baselineToForm(spec.initial_baseline),
    phases: spec.phases.map(p => ({
      id: p.id,
      enter_when: parseConditionStr(p.enter_when),
      baseline: baselineToForm(p.baseline),
      events: [...p.events],
      resolve_when: parseConditionStr(p.resolve_when),
      resolve_snap: snapToForm(p.resolve_snap),
      fail_when: parseConditionStr(p.fail_when),
      fail_snap: snapToForm(p.fail_snap),
      hints_if_missing: Object.entries(p.hints_if_missing).map(([id, hint]) => ({ id, hint })),
    })),
    debriefBody: body,
  }
}

// ── constants ─────────────────────────────────────────────────────────────────

const INTERVENTION_IDS = [
  'adrenaline-1', 'adrenaline-10', 'metaraminol', 'ephedrine', 'propofol', 'dantrolene',
  'intubate', 're-intubate', 'extubate', 'jaw-thrust', 'guedel', 'sga', 'suction',
  'increase-fio2', 'increase-tv', 'increase-rr', 'peep-up', 'manual-vent',
  'fluid-bolus', 'defibrillate', 'cpr', 'chest-decompression',
  'arterial-line', 'cvp-line', 'bis-monitor',
]

const EMPTY_SNAP: SnapForm = snapToForm()
const EMPTY_BASELINE: BaselineForm = baselineToForm()

const EMPTY_PHASE: PhaseForm = {
  id: '',
  enter_when: emptyConditionField(),
  baseline: { ...EMPTY_BASELINE },
  events: [],
  resolve_when: emptyConditionField(),
  resolve_snap: { ...EMPTY_SNAP },
  fail_when: emptyConditionField(),
  fail_snap: { ...EMPTY_SNAP },
  hints_if_missing: [],
}

const INITIAL_STATE: CreatorState = {
  id: '', label: '', description: '', difficulty: 'medium',
  hints: [],
  initial_state: { ...EMPTY_SNAP },
  initial_baseline: { ...EMPTY_BASELINE },
  phases: [{ ...EMPTY_PHASE, id: 'onset' }],
  debriefBody: '',
}

// ── style constants ───────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #e0ddd5',
  background: '#fff', fontSize: 14, color: '#2c2c2c', fontFamily: 'inherit',
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, letterSpacing: 3, color: '#888',
      textTransform: 'uppercase', borderBottom: '1px solid #e0ddd5',
      paddingBottom: 8, marginBottom: 16, marginTop: 32,
    }}>
      {title}
    </div>
  )
}

function VitalsInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        style={{ ...INPUT, width: 72 }}
        type="number"
        value={value}
        placeholder={placeholder ?? '—'}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  )
}

function BaselineFields({ value, onChange }: {
  value: BaselineForm
  onChange: (v: BaselineForm) => void
}) {
  const set = (key: keyof BaselineForm) => (v: string) => onChange({ ...value, [key]: v })
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <VitalsInput label="HR" value={value.hr} onChange={set('hr')} placeholder="bpm" />
      <VitalsInput label="SpO₂" value={value.spo2} onChange={set('spo2')} placeholder="%" />
      <VitalsInput label="EtCO₂" value={value.etco2} onChange={set('etco2')} placeholder="kPa" />
      <VitalsInput label="RR" value={value.rr} onChange={set('rr')} placeholder="/min" />
      <VitalsInput label="Temp" value={value.temp} onChange={set('temp')} placeholder="°C" />
      <VitalsInput label="NIBP sys" value={value.nibp_sys} onChange={set('nibp_sys')} placeholder="mmHg" />
      <VitalsInput label="NIBP dia" value={value.nibp_dia} onChange={set('nibp_dia')} placeholder="mmHg" />
    </div>
  )
}

function SnapFields({ value, onChange }: {
  value: SnapForm
  onChange: (v: SnapForm) => void
}) {
  const set = (key: keyof SnapForm) => (v: string) => onChange({ ...value, [key]: v })
  return (
    <div>
      <BaselineFields value={value} onChange={bv => onChange({ ...value, ...bv })} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>ECG Rhythm</span>
          <select style={{ ...INPUT, width: 130 }} value={value.ecgRhythm} onChange={e => set('ecgRhythm')(e.target.value)}>
            <option value="">— unchanged —</option>
            <option value="sinus">Sinus</option>
            <option value="svt">SVT</option>
            <option value="vt">VT</option>
            <option value="vf">VF</option>
            <option value="asystole">Asystole</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Tube Position</span>
          <select style={{ ...INPUT, width: 140 }} value={value.tubePosition} onChange={e => set('tubePosition')(e.target.value)}>
            <option value="">— unchanged —</option>
            <option value="none">None</option>
            <option value="trachea">Trachea</option>
            <option value="oesophagus">Oesophagus</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function ConditionRowEditor({ row, onChange, onRemove }: {
  row: ConditionRow
  onChange: (r: ConditionRow) => void
  onRemove: () => void
}) {
  const isNumeric = NUMERIC_SUBJECTS.has(row.subject)
  const isTube = row.subject === 'tube_position'
  const needsOp = isNumeric || isTube || row.subject === 'intervention_count'
  const needsValue = isNumeric || isTube || row.subject === 'intervention_count'
  const needsRefId = REF_SUBJECTS.has(row.subject)

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
      background: '#f9f8f5', borderRadius: 8, padding: '10px 12px', border: '1px solid #e8e5de',
    }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>When</span>
        <select
          style={{ ...INPUT, minWidth: 220 }}
          value={row.subject}
          onChange={e => onChange({ ...row, subject: e.target.value as ConditionSubject, op: '', value: '', refId: '' })}
        >
          <option value="">— choose —</option>
          <optgroup label="Time">
            <option value="time">Scenario time (seconds elapsed)</option>
            <option value="phase_elapsed">Time in this phase (seconds)</option>
          </optgroup>
          <optgroup label="Vital signs">
            <option value="hr">Heart rate – HR (bpm)</option>
            <option value="spo2">SpO₂ (%)</option>
            <option value="etco2">EtCO₂ (kPa)</option>
            <option value="rr">Respiratory rate (/min)</option>
            <option value="temp">Temperature (°C)</option>
          </optgroup>
          <optgroup label="Airway">
            <option value="tube_position">Tube position</option>
          </optgroup>
          <optgroup label="Interventions">
            <option value="intervention_given">Intervention HAS been given</option>
            <option value="intervention_not_given">Intervention has NOT been given</option>
            <option value="intervention_count">Intervention given N times</option>
          </optgroup>
          <optgroup label="Phases">
            <option value="phase_done">A previous phase has completed</option>
          </optgroup>
        </select>
      </label>

      {needsOp && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Is</span>
          <select
            style={{ ...INPUT, minWidth: isTube ? 160 : 150 }}
            value={row.op}
            onChange={e => onChange({ ...row, op: e.target.value as ConditionOp })}
          >
            <option value="">— select —</option>
            {isTube ? (
              <>
                <option value="==">equals</option>
                <option value="!=">does not equal</option>
              </>
            ) : (
              Object.entries(OP_LABELS).map(([op, label]) => (
                <option key={op} value={op}>{label}</option>
              ))
            )}
          </select>
        </label>
      )}

      {needsValue && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Value</span>
          {isTube ? (
            <select
              style={{ ...INPUT, width: 160 }}
              value={row.value}
              onChange={e => onChange({ ...row, value: e.target.value })}
            >
              <option value="">— select —</option>
              <option value="trachea">Trachea</option>
              <option value="oesophagus">Oesophagus</option>
              <option value="none">None (not intubated)</option>
            </select>
          ) : (
            <input
              type="number"
              style={{ ...INPUT, width: 90 }}
              value={row.value}
              placeholder={
                row.subject === 'time' || row.subject === 'phase_elapsed' ? 'sec'
                  : row.subject === 'hr' ? 'bpm'
                  : row.subject === 'spo2' ? '%'
                  : row.subject === 'etco2' ? 'kPa'
                  : row.subject === 'rr' ? '/min'
                  : row.subject === 'temp' ? '°C'
                  : 'n'
              }
              onChange={e => onChange({ ...row, value: e.target.value })}
            />
          )}
        </label>
      )}

      {needsRefId && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>
            {row.subject === 'phase_done' ? 'Phase ID' : 'Intervention'}
          </span>
          <input
            style={{ ...INPUT, width: 200 }}
            value={row.refId}
            list={row.subject !== 'phase_done' ? 'intervention-ids' : undefined}
            placeholder={row.subject === 'phase_done' ? 'e.g. onset' : 'pick or type id'}
            onChange={e => onChange({ ...row, refId: e.target.value })}
          />
        </label>
      )}

      <button
        onClick={onRemove}
        style={{ ...INPUT, padding: '7px 10px', cursor: 'pointer', color: '#cc3333', alignSelf: 'flex-end' }}
      >
        ✕
      </button>
    </div>
  )
}

function ConditionBuilder({ field, onChange, isEnterWhen = false }: {
  field: ConditionField
  onChange: (f: ConditionField) => void
  isEnterWhen?: boolean
}) {
  if (field.mode === 'raw') {
    return (
      <div style={{ background: '#fffbf0', border: '1px solid #e8d8a0', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
          Advanced mode — edit the raw expression directly.
        </div>
        <input
          style={{ ...INPUT, width: '100%', fontFamily: 'monospace', marginBottom: 8 }}
          value={field.raw}
          onChange={e => onChange({ ...field, raw: e.target.value })}
          placeholder="e.g. time > 30 && !any('adrenaline-*')"
        />
        <button
          onClick={() => {
            const parsed = parseConditionStr(field.raw)
            if (parsed.mode === 'builder') onChange(parsed)
          }}
          style={{ ...INPUT, cursor: 'pointer', fontSize: 12, color: '#1a5276', padding: '5px 10px', marginRight: 8 }}
        >
          Try builder view ↩
        </button>
        <button
          onClick={() => onChange(emptyConditionField())}
          style={{ ...INPUT, cursor: 'pointer', fontSize: 12, color: '#cc3333', padding: '5px 10px' }}
        >
          Clear
        </button>
      </div>
    )
  }

  const updateRow = (i: number, row: ConditionRow) => {
    const rows = [...field.rows]; rows[i] = row; onChange({ ...field, rows })
  }
  const removeRow = (i: number) => {
    onChange({ ...field, rows: field.rows.filter((_, idx) => idx !== i) })
  }
  const toggleJoin = () => onChange({ ...field, join: field.join === 'AND' ? 'OR' : 'AND' })

  const preview = conditionFieldToStr(field)

  return (
    <div>
      {field.rows.length === 0 && (
        <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic', marginBottom: 8 }}>
          {isEnterWhen
            ? 'No conditions — this phase is always eligible (use for the first / fallback phase)'
            : 'No conditions — this outcome will never trigger automatically'}
        </div>
      )}

      {field.rows.map((row, i) => (
        <div key={row.key}>
          {i > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
              <button
                onClick={toggleJoin}
                title="Click to toggle AND / OR"
                style={{
                  padding: '3px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 700,
                  fontSize: 12, letterSpacing: 1, border: 'none',
                  background: field.join === 'AND' ? '#1a5276' : '#cc7700',
                  color: '#fff',
                }}
              >
                {field.join}
              </button>
              <div style={{ flex: 1, height: 1, background: '#e0ddd5' }} />
            </div>
          )}
          <ConditionRowEditor row={row} onChange={r => updateRow(i, r)} onRemove={() => removeRow(i)} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => onChange({ ...field, rows: [...field.rows, emptyRow()] })}
          style={{ ...INPUT, cursor: 'pointer', fontSize: 12, color: '#1a5276', padding: '6px 12px' }}
        >
          + Add Condition
        </button>
        <button
          onClick={() => onChange({ ...field, mode: 'raw', raw: preview ?? '' })}
          style={{ ...INPUT, cursor: 'pointer', fontSize: 11, color: '#aaa', padding: '5px 10px' }}
        >
          Advanced ↗
        </button>
        {preview && (
          <code style={{
            fontSize: 11, color: '#555', background: '#f0f0eb',
            borderRadius: 4, padding: '3px 7px', flex: 1, wordBreak: 'break-all',
          }}>
            {preview}
          </code>
        )}
      </div>
    </div>
  )
}

function PhaseCard({ phase, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  phase: PhaseForm
  index: number
  total: number
  onChange: (p: PhaseForm) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const set = <K extends keyof PhaseForm>(key: K) => (v: PhaseForm[K]) =>
    onChange({ ...phase, [key]: v })

  return (
    <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, border: '1px solid #e0ddd5', background: '#fff' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1a5276', letterSpacing: 1, textTransform: 'uppercase' }}>
          Phase {index + 1}{phase.id ? `: ${phase.id}` : ''}
        </div>
        <button onClick={onMoveUp} disabled={index === 0} style={{ ...INPUT, padding: '4px 8px', cursor: 'pointer', fontSize: 12, opacity: index === 0 ? 0.4 : 1 }}>↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1} style={{ ...INPUT, padding: '4px 8px', cursor: 'pointer', fontSize: 12, opacity: index === total - 1 ? 0.4 : 1 }}>↓</button>
        <button onClick={onRemove} style={{ ...INPUT, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#cc3333' }}>✕</button>
      </div>

      {/* id + enter_when */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 140px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Phase ID</span>
          <input style={{ ...INPUT }} value={phase.id} placeholder="e.g. onset" onChange={e => set('id')(e.target.value)} />
        </label>
        <div style={{ flex: '1 1 340px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            When does this phase become active?
            <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              no conditions = always eligible (first / fallback phase)
            </span>
          </div>
          <ConditionBuilder field={phase.enter_when} onChange={v => set('enter_when')(v)} isEnterWhen />
        </div>
      </div>

      {/* baseline */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
        Baseline
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
        Vitals drift toward these values while this phase is active (~1 unit/sec). Leave blank to inherit the previous phase's baseline.
      </div>
      <BaselineFields value={phase.baseline} onChange={v => set('baseline')(v)} />

      {/* timed events */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 4 }}>
        Timed Events
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
        Messages shown at a fixed time after this phase becomes active. Format: <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>30s</code>
      </div>
      {phase.events.map((ev, ei) => (
        <div key={ei} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            style={{ ...INPUT, width: 72, fontFamily: 'monospace' }}
            value={ev.at} placeholder="e.g. 10s"
            onChange={e => {
              const evs = [...phase.events]; evs[ei] = { ...evs[ei], at: e.target.value }
              set('events')(evs)
            }}
          />
          <input
            style={{ ...INPUT, flex: 1 }}
            value={ev.text} placeholder="Event message"
            onChange={e => {
              const evs = [...phase.events]; evs[ei] = { ...evs[ei], text: e.target.value }
              set('events')(evs)
            }}
          />
          <button onClick={() => set('events')(phase.events.filter((_, i) => i !== ei))}
            style={{ ...INPUT, padding: '4px 8px', cursor: 'pointer', color: '#cc3333' }}>✕</button>
        </div>
      ))}
      <button onClick={() => set('events')([...phase.events, { at: '', text: '' }])}
        style={{ ...INPUT, cursor: 'pointer', fontSize: 12, color: '#1a5276', padding: '6px 12px' }}>
        + Add Event
      </button>

      {/* resolve */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0ede6' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#27ae60', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          Scenario succeeds when…
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>
          When all conditions below are true the scenario ends in success. Leave empty if this phase doesn't end the scenario.
        </div>
        <ConditionBuilder field={phase.resolve_when} onChange={v => set('resolve_when')(v)} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>
          Resolve Snap
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
          Vitals snapped instantly when the scenario succeeds. Leave blank to freeze on current values.
        </div>
        <SnapFields value={phase.resolve_snap} onChange={v => set('resolve_snap')(v)} />
      </div>

      {/* fail */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0ede6' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#cc3333', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          Scenario fails when…
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>
          When all conditions below are true the scenario ends in failure. Leave empty if this phase can't trigger failure.
        </div>
        <ConditionBuilder field={phase.fail_when} onChange={v => set('fail_when')(v)} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>
          Fail Snap
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
          Vitals snapped instantly when the scenario fails. e.g. set ECG Rhythm to Asystole.
        </div>
        <SnapFields value={phase.fail_snap} onChange={v => set('fail_snap')(v)} />
      </div>

      {/* hints_if_missing */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0ede6' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          Hints if Missing
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
          In Guided mode: if the trainee hasn't given this intervention yet, show the hint. Type or pick an intervention ID — autocomplete available.
        </div>
        {phase.hints_if_missing.map((h, hi) => (
          <div key={hi} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              style={{ ...INPUT, width: 180, fontFamily: 'monospace' }}
              value={h.id} placeholder="pick intervention id"
              list="intervention-ids"
              onChange={e => {
                const hs = [...phase.hints_if_missing]; hs[hi] = { ...hs[hi], id: e.target.value }
                set('hints_if_missing')(hs)
              }}
            />
            <input
              style={{ ...INPUT, flex: 1 }}
              value={h.hint} placeholder="Hint text"
              onChange={e => {
                const hs = [...phase.hints_if_missing]; hs[hi] = { ...hs[hi], hint: e.target.value }
                set('hints_if_missing')(hs)
              }}
            />
            <button onClick={() => set('hints_if_missing')(phase.hints_if_missing.filter((_, i) => i !== hi))}
              style={{ ...INPUT, padding: '4px 8px', cursor: 'pointer', color: '#cc3333' }}>✕</button>
          </div>
        ))}
        <button onClick={() => set('hints_if_missing')([...phase.hints_if_missing, { id: '', hint: '' }])}
          style={{ ...INPUT, cursor: 'pointer', fontSize: 12, color: '#1a5276', padding: '6px 12px' }}>
          + Add Hint
        </button>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

interface ScenarioCreatorProps {
  onBack: () => void
}

const ScenarioCreator: FC<ScenarioCreatorProps> = ({ onBack }) => {
  const { loadScenario } = useSimulation()
  const [state, setState] = useState<CreatorState>(INITIAL_STATE)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ width: '100%', height: '100vh', overflowY: 'auto', background: '#f5f5f0' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <button onClick={onBack} style={{ ...INPUT, cursor: 'pointer', padding: '8px 16px' }}>← Back</button>
          <div style={{ flex: 1, fontSize: 20, fontWeight: 700, color: '#1a5276', letterSpacing: 3, textTransform: 'uppercase' }}>
            Scenario Creator
          </div>
          <button
            onClick={() => {
              const spec = creatorStateToSpec(state)
              const md = assembleMarkdown(spec, state.debriefBody)
              const blob = new Blob([md], { type: 'text/markdown' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `${spec.id || 'scenario'}.md`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{
              padding: '10px 20px', borderRadius: 6, border: '2px solid #1a5276',
              background: 'rgba(26,82,118,0.05)', color: '#1a5276',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Download .md
          </button>
        </div>

        {error && (
          <div style={{
            margin: '12px 0', padding: '10px 14px', borderRadius: 6,
            background: '#fff0f0', border: '1px solid #ffcccc', color: '#cc3333',
            fontSize: 13, whiteSpace: 'pre-wrap',
          }}>
            {error}
          </div>
        )}

        {/* ── Metadata ────────────────────────────────────────────────── */}
        <SectionHeader title="Metadata" />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>ID</span>
            <input style={{ ...INPUT }} value={state.id} placeholder="e.g. anaphylaxis"
              onChange={e => setState(s => ({ ...s, id: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Label</span>
            <input style={{ ...INPUT }} value={state.label} placeholder="Display name"
              onChange={e => setState(s => ({ ...s, label: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Difficulty</span>
            <select style={{ ...INPUT, width: 120 }} value={state.difficulty}
              onChange={e => setState(s => ({ ...s, difficulty: e.target.value as CreatorState['difficulty'] }))}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Description</span>
          <input style={{ ...INPUT }} value={state.description} placeholder="One-line summary shown in scenario list"
            onChange={e => setState(s => ({ ...s, description: e.target.value }))} />
        </label>

        {/* ── Initial State ────────────────────────────────────────────── */}
        <SectionHeader title="Initial State" />
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
          Vitals set instantly when the scenario starts. Leave blank to keep defaults.
        </p>
        <SnapFields value={state.initial_state} onChange={v => setState(s => ({ ...s, initial_state: v }))} />

        {/* ── Initial Baseline ─────────────────────────────────────────── */}
        <SectionHeader title="Initial Baseline (drift targets)" />
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
          The patient slowly drifts toward these values each tick. Leave blank to keep defaults.
        </p>
        <BaselineFields value={state.initial_baseline} onChange={v => setState(s => ({ ...s, initial_baseline: v }))} />

        {/* datalist for intervention ID autocomplete */}
        <datalist id="intervention-ids">
          {INTERVENTION_IDS.map(id => <option key={id} value={id} />)}
        </datalist>

        {/* ── Phases ──────────────────────────────────────────────────── */}
        <SectionHeader title="Phases" />
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
          Phases are evaluated in order — <strong>last matching condition wins</strong>.
          List from least to most specific. The first phase typically has no trigger condition (it's always the fallback).
        </p>
        {state.phases.map((phase, i) => (
          <PhaseCard
            key={i}
            phase={phase}
            index={i}
            total={state.phases.length}
            onChange={p => setState(s => {
              const phases = [...s.phases]; phases[i] = p; return { ...s, phases }
            })}
            onRemove={() => setState(s => ({ ...s, phases: s.phases.filter((_, idx) => idx !== i) }))}
            onMoveUp={() => setState(s => {
              if (i === 0) return s
              const phases = [...s.phases]
              ;[phases[i - 1], phases[i]] = [phases[i], phases[i - 1]]
              return { ...s, phases }
            })}
            onMoveDown={() => setState(s => {
              if (i === s.phases.length - 1) return s
              const phases = [...s.phases]
              ;[phases[i], phases[i + 1]] = [phases[i + 1], phases[i]]
              return { ...s, phases }
            })}
          />
        ))}
        <button
          onClick={() => setState(s => ({ ...s, phases: [...s.phases, { ...EMPTY_PHASE }] }))}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, border: '1px dashed #c0bdb5',
            background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 14,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}
        >
          + Add Phase
        </button>

        {/* ── Debrief ──────────────────────────────────────────────────── */}
        <SectionHeader title="Debrief (Markdown)" />
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
          Shown to the trainee after the scenario ends. Supports Markdown.
        </p>
        <textarea
          style={{
            ...INPUT, width: '100%', minHeight: 200, resize: 'vertical',
            lineHeight: 1.6, fontFamily: 'monospace', fontSize: 13,
          }}
          value={state.debriefBody}
          placeholder={'# Scenario Name — debrief\n\n## Recognition\n\n- Key sign 1\n\n## Management\n\n1. Step one\n'}
          onChange={e => setState(s => ({ ...s, debriefBody: e.target.value }))}
        />

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = evt => {
                const raw = evt.target?.result as string
                try {
                  const { spec, body } = parseScenarioFile(raw, file.name)
                  setState(specToCreatorState(spec, body))
                  setError(null)
                } catch (err) {
                  setError((err as Error).message)
                }
              }
              reader.readAsText(file)
              e.target.value = ''
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ ...INPUT, cursor: 'pointer', padding: '10px 20px', color: '#555', fontWeight: 600, fontSize: 14 }}
          >
            Upload .md
          </button>

          <button
            onClick={() => {
              const spec = creatorStateToSpec(state)
              const rawMd = assembleMarkdown(spec, state.debriefBody)
              const result = loadScenario(rawMd)
              if (result.ok) {
                onBack()
              } else {
                setError(result.error)
              }
            }}
            style={{
              padding: '10px 28px', borderRadius: 6, border: '2px solid #1a5276',
              background: '#1a5276', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Load into Game ▶
          </button>

          <span style={{ fontSize: 12, color: '#bbb' }}>
            Loaded scenarios appear in the scenario list and persist until you refresh.
          </span>
        </div>

      </div>
    </div>
  )
}

export default ScenarioCreator
