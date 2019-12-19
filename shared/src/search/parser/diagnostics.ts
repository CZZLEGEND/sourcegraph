import { Sequence } from './parser'
import * as Monaco from 'monaco-editor'

const VALID = { valid: true as const }

type Validator = (value: string) => typeof VALID | { valid: false; expected: string }

const anyValue: Validator = () => VALID

const pattern = (p: RegExp, expected: string): Validator => value =>
    value.match(p) !== null ? VALID : { valid: false, expected }

const FILTERS: { [index: string]: Validator } = {
    repo: anyValue,
    r: anyValue,
    '-repo': anyValue,
    '-r': anyValue,
    case: pattern(/^(yes|no)$/, 'yes, no'),
    type: pattern(/^(code, diff, commit, symbol)$/, 'code, diff, commit, symbol'),
}

export function getDiagnostics({ members }: Pick<Sequence, 'members'>): Monaco.editor.IMarkerData[] {
    const diagnostics: Monaco.editor.IMarkerData[] = []
    for (const { token, range } of members) {
        if (token.type === 'filter') {
            const { filterType, filterValue } = token
            const validateFilterValue = FILTERS[filterType.token.value]
            if (!validateFilterValue) {
                diagnostics.push({
                    severity: Monaco.MarkerSeverity.Error,
                    message: `Invalid filter type: ${filterType.token.value}`,
                    startLineNumber: 0,
                    endLineNumber: 0,
                    startColumn: filterType.range.start + 1,
                    endColumn: filterType.range.end + 1,
                })
                continue
            }
            const valueRes = validateFilterValue(filterValue.token.value)
            if (!valueRes.valid) {
                diagnostics.push({
                    severity: Monaco.MarkerSeverity.Error,
                    message: `Invalid filter value, expected: ${valueRes.expected}`,
                    startLineNumber: 0,
                    endLineNumber: 0,
                    startColumn: filterValue.range.start + 1,
                    endColumn: filterValue.range.end + 1,
                })
            }
        } else if (token.type === 'word') {
            if (token.value.includes(':')) {
                diagnostics.push({
                    severity: Monaco.MarkerSeverity.Warning,
                    message: 'Quoting the query may help if you want a literal match.',
                    startLineNumber: 0,
                    endLineNumber: 0,
                    startColumn: range.start + 1,
                    endColumn: range.end + 1,
                })
            }
        }
    }
    return diagnostics
}
