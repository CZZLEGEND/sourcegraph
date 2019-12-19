interface CharacterRange {
    start: number
    end: number
}

interface Word {
    type: 'word'
    value: string
}

export interface Filter {
    type: 'filter'
    filterType: Pick<ParseSuccess<Word>, 'range' | 'token'>
    filterValue: Pick<ParseSuccess<Word>, 'range' | 'token'>
}

export interface Sequence {
    type: 'sequence'
    members: Pick<ParseSuccess<Exclude<Token, Sequence>>, 'range' | 'token'>[]
}

interface Quoted {
    type: 'quoted'
    quotedValue: string
}

type Token = { type: 'whitespace' | 'eof' } | Word | Filter | Sequence | Quoted

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
              range: { start, end: start },
          }
        : { type: 'error', expected: 'EOF', at: start }

const flatten = (members: Pick<ParseSuccess, 'range' | 'token'>[]): Sequence['members'] =>
    members.reduce(
        (merged: Sequence['members'], { range, token }) =>
            token.type === 'sequence' ? [...merged, ...flatten(token.members)] : [...merged, { token, range }],
        []
    )

const chain = (...parsers: Parser[]): Parser<Sequence> => (input, start) => {
    const members: Pick<ParseSuccess, 'range' | 'token'>[] = []
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

const zeroOrMore = (parse: Parser): Parser<Sequence> => (input, start) => {
    const members: Pick<ParseSuccess, 'range' | 'token'>[] = []
    let end = start
    let result = parse(input, start)
    while (result.type !== 'error') {
        const { token, range } = result
        members.push({ token, range })
        end = result.range.end
        result = parse(input, end + 1)
    }
    return {
        type: 'success',
        range: { start, end },
        token: { type: 'sequence', members: flatten(members) },
    }
}

const oneOf = (...parsers: Parser[]): Parser => (input, start) => {
    const expected: string[] = []
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
    while (input[end] && (input[end] !== '"' || input[end - 1] === '\\')) {
        end = end + 1
    }
    if (!input[end]) {
        return { type: 'error', expected: '"', at: end }
    }
    return {
        type: 'success',
        range: { start, end },
        token: { type: 'quoted', quotedValue: input.substring(start + 1, end) },
    }
}

const character = (c: string): Parser<Word> => (input, start) => {
    if (input[start] !== c) {
        return { type: 'error', expected: c, at: start }
    }
    return {
        type: 'success',
        range: { start, end: start },
        token: { type: 'word', value: c },
    }
}

const pattern = <T = Word>(p: RegExp, output?: T, expected?: string): Parser<T> => {
    if (!p.source.startsWith('^')) {
        p = new RegExp(`^${p.source}`)
    }
    return (input, start) => {
        const matchTarget = input.substring(start)
        if (!matchTarget) {
            return { type: 'error', expected: expected || `/${p.source}/`, at: start }
        }
        const match = input.substring(start).match(p)
        if (!match) {
            return { type: 'error', expected: expected || `/${p.source}/`, at: start }
        }
        return {
            type: 'success',
            range: { start, end: start + match[0].length - 1 },
            token: (output || { type: 'word', value: match[0] }) as T,
        }
    }
}

const whitespace = pattern(/\s+/, { type: 'whitespace' as const }, 'whitespace')

const literal = pattern(/[^\s"]+/)

const filterKeyword = pattern(/-?[a-z]+(?=:)/)

const filterDelimiter = character(':')

const filterValue = pattern(/[^:\s]+/)

const filter: Parser<Filter> = (input, start) => {
    const parsedKeyword = filterKeyword(input, start)
    if (parsedKeyword.type === 'error') {
        return parsedKeyword
    }
    const parsedDelimiter = filterDelimiter(input, parsedKeyword.range.end + 1)
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
        },
    }
}

const searchQuery = chain(zeroOrMore(oneOf(filter, quoted, literal, whitespace)), eof)

export const parseSearchQuery = (query: string): ParserResult<Sequence> => searchQuery(query, 0)
