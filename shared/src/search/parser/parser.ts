interface CharacterRange {
    start: number
    end: number
}

interface Word {
    type: 'word'
    value: string
}

interface SearchTerm {
    type: 'searchTerm'
    value: string
    warning?: string
}

interface Filter {
    type: 'filter'
    filterType: Pick<ParseSuccess<Word>, 'range' | 'token'>
    filterValue: Pick<ParseSuccess<Word>, 'range' | 'token'>
    warning?: string
}

interface Sequence {
    type: 'sequence'
    members: Pick<ParseSuccess, 'range' | 'token'>[]
}

type Token =
    | Filter
    | {
          type: 'whitespace'
      }
    | {
          type: 'eof'
      }
    | {
          type: 'quoted'
      }
    | Sequence
    | Word
    | SearchTerm

interface ParseError {
    type: 'error'
    expected: string
    at: number
}

interface ParseSuccess<T = Token> {
    type: 'success'
    token: T
    range: CharacterRange
}

type ParserResult<T = Token> = ParseError | ParseSuccess<T>

type Parser<T = Token> = (input: string, start: number) => ParserResult<T>

const eof: Parser = (input, start) =>
    input[start] === undefined
        ? {
              type: 'success',
              token: {
                  type: 'eof',
              },
              range: { start: start, end: start },
          }
        : { type: 'error', expected: 'EOF', at: start }

const whitespace: Parser = (input, start) => {
    const whitespace = /\s/
    if (!input[start] || !input[start].match(whitespace)) {
        return { type: 'error', expected: 'whitespace', at: start }
    }
    let end = start
    while (input[end + 1].match(whitespace)) {
        end = end + 1
    }
    return {
        type: 'success',
        token: { type: 'whitespace' },
        range: { start, end },
    }
}

const chain = (...parsers: Parser[]): Parser<Sequence> => (input, start = 0) => {
    const members: Sequence['members'] = []
    let firstParser = true
    let end = start
    for (const parser of parsers) {
        const result = parser(input, firstParser ? start : end + 1)
        if (result.type === 'error') {
            return result
        }
        const { token, range } = result
        members.push({ token, range })
        end = result.range.end
        firstParser = false
    }
    return {
        type: 'success',
        token: { type: 'sequence', members: flatten(members) },
        range: { start, end },
    }
}

const oneOrMore = (parse: Parser): Parser<Sequence> => (input, start = 0) => {
    const members: Sequence['members'] = []
    let end = start
    let result = parse(input, start)
    while (result.type !== 'error') {
        const { token, range } = result
        members.push({ token, range })
        end = result.range.end
        result = parse(input, end + 1)
    }
    if (members.length === 0) {
        return {
            type: 'error',
            expected: `one or more ${result.expected}`,
            at: start,
        }
    }
    return {
        type: 'success',
        range: { start, end },
        token: { type: 'sequence', members: flatten(members) },
    }
}

const oneOf = (...parsers: Parser[]): Parser => (input, start) => {
    let expected: string[] = []
    for (const parser of parsers) {
        const result = parser(input, start)
        if (result.type === 'success') {
            return result
        }
        expected.push(result.expected)
    }
    return {
        type: 'error',
        expected: `One of: ${expected.join(', ')}`,
        at: start,
    }
}

const quoted: Parser = (input, start) => {
    if (input[start] !== '"') {
        return { type: 'error', expected: '"', at: start }
    }
    let end = start + 1
    while (input[end] && input[end] !== '"') {
        end = end + 1
    }
    if (!input[end]) {
        return { type: 'error', expected: '"', at: end }
    }
    return {
        type: 'success',
        range: { start, end },
        token: { type: 'quoted', value: input.substring(start + 1, end) },
    }
}

const character = (c: string): Parser<Word> => (input, start) => {
    if (input[start] != c) {
        return { type: 'error', expected: c, at: start }
    }
    return {
        type: 'success',
        range: { start, end: start },
        token: { type: 'word', value: c },
    }
}

const pattern = (p: RegExp): Parser<Word> => {
    if (!p.source.startsWith('^')) {
        p = new RegExp(`^${p.source}`)
    }
    return (input, start) => {
        const matchTarget = input.substring(start)
        if (!matchTarget) {
            return { type: 'error', expected: `/${p.source}/`, at: start }
        }
        const match = input.substring(start).match(p)
        if (!match) {
            return { type: 'error', expected: `/${p.source}/`, at: start }
        }
        return {
            type: 'success',
            range: { start, end: start + match[0].length - 1 },
            token: { type: 'word', value: match[0] },
        }
    }
}

const literalPattern = pattern(/[^\s"]+/)

const literal: Parser<SearchTerm> = (input, start) => {
    const result = literalPattern(input, start)
    if (result.type === 'error') {
        return result
    }
    return {
        type: 'success',
        range: result.range,
        token: {
            type: 'searchTerm',
            value: result.token.value,
        },
    }
}

const filterKeyword = pattern(/-?[a-z]+(?=:)/)

const filterDelimieter = character(':')

const filterValue = pattern(/[^:\s]+/)

const flatten = (members: Sequence['members']): Sequence['members'] =>
    members.reduce(
        (merged: Sequence['members'], { range, token }) =>
            token.type === 'sequence' ? [...merged, ...flatten(token.members)] : [...merged, { token, range }],
        []
    )

const filterWarning = (filterType: string, filterValue: string): string | undefined => undefined

const filter: Parser<Filter> = (input, start) => {
    const parsedKeyword = filterKeyword(input, start)
    if (parsedKeyword.type === 'error') {
        return parsedKeyword
    }
    const parsedDelimiter = filterDelimieter(input, parsedKeyword.range.end + 1)
    if (parsedDelimiter.type === 'error') {
        return parsedDelimiter
    }
    const parsedValue = filterValue(input, parsedDelimiter.range.end + 1)
    if (parsedValue.type === 'error') {
        return parsedValue
    }
    return {
        type: 'success',
        range: { start, end: parsedValue.range.end },
        token: {
            type: 'filter',
            filterType: parsedKeyword,
            filterValue: parsedValue,
            warning: filterWarning(parsedKeyword.token.value, parsedValue.token.value),
        },
    }
}

export const parseSearchQuery = chain(oneOrMore(oneOf(filter, quoted, literal, whitespace)), eof)

console.log(JSON.stringify(parseSearchQuery('lang:go repo:^github.com/gorilla/mux$ case:yes Router', 0), null, 2))

const tests: [string, Parser][] = [
    ['"hello world"', quoted],
    ['', eof],
    [':', oneOf(character(';'), character(':'))],
    [':;', chain(character(':'), character(';'), eof)],
    ['"hello" world"', chain(oneOrMore(quoted), eof)],
    ['-repo:', pattern(/-?[a-z]+(?=:)/)],
    ['-repo:^github.com/gorilla/mux$', filter],
    ['-repo:^github.com/gorilla/mux$', chain(filter, eof)],
    ['lang:go repo:^github.com/gorilla/mux$ case:yes Router', parseSearchQuery],
]

for (const [input, test] of tests) {
    console.log(JSON.stringify(test(input, 0), null, 2))
}
