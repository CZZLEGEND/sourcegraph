import { Sequence } from './parser'
import { validateFilter } from './filters'
import * as Monaco from 'monaco-editor'

export function getDiagnostics({ members }: Pick<Sequence, 'members'>): Monaco.editor.IMarkerData[] {
    const diagnostics: Monaco.editor.IMarkerData[] = []
    for (const { token, range } of members) {
        if (token.type === 'filter') {
            const { filterType, filterValue } = token
            const validationResult = validateFilter(filterType.token.value, filterValue.token.value)
            if (validationResult.valid) {
                continue
            }
            diagnostics.push({
                severity: Monaco.MarkerSeverity.Error,
                message: validationResult.reason,
                startLineNumber: 0,
                endLineNumber: 0,
                startColumn: filterType.range.start + 1,
                endColumn: filterType.range.end + 1,
            })
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
