import { SearchSuggestion } from '../../graphql/schema'

interface FilterDefinition {
    aliases: string[]
    description: string
    discreteValues?: string[]
    suggestions?: SearchSuggestion['__typename'] | string[]
    default?: string
}

export const FILTERS: readonly FilterDefinition[] = [
    {
        aliases: ['r', 'repo'],
        description: 'Include only results from repositories matching the given regex pattern.',
        suggestions: 'Repository',
    },
    {
        aliases: ['-r', '-repo'],
        description: 'Exclude results from repositories matching the given regex pattern.',
        suggestions: 'Repository',
    },
    {
        aliases: ['f', 'file'],
        description: 'Include only results from files matching the given regex pattern.',
        suggestions: 'Repository',
    },
    {
        aliases: ['-f', '-file'],
        description: 'Exclude results from files matching the given regex pattern.',
        suggestions: 'Repository',
    },
    {
        aliases: ['repogroup'],
        description: 'group-name (include results from the named group)',
    },
    {
        aliases: ['repohasfile'],
        description: 'regex-pattern (include results from repos that contain a matching file)',
    },
    {
        aliases: ['-repohasfile'],
        description: 'regex-pattern (exclude results from repositories that contain a matching file)',
    },
    {
        aliases: ['repohascommitafter'],
        description: '"string specifying time frame" (filter out stale repositories without recent commits)',
    },
    {
        aliases: ['type'],
        description: 'Limit results to the specified type.',
        discreteValues: ['code', 'diff', 'commit', 'symbol'],
    },
    {
        aliases: ['case'],
        description: 'Treat the search pattern as case-sensitive.',
        discreteValues: ['yes', 'no'],
        default: 'no',
    },
    {
        aliases: ['lang'],
        description: 'Include only results from the given language',
        discreteValues: ['ts', 'go', 'js', 'cpp'],
    },
    {
        aliases: ['-lang'],
        description: 'Exclude results from the given language',
        discreteValues: ['ts', 'go', 'js', 'cpp'],
    },
    {
        aliases: ['fork'],
        description: 'Fork',
    },
    {
        aliases: ['archived'],
        description: 'Archived',
    },
    {
        aliases: ['count'],
        description: 'Number of results to fetch (integer)',
    },
    {
        aliases: ['timeout'],
        description: 'Duration before timeout',
    },
]

export const validateFilter = (
    filterType: string,
    filterValue: string
): { valid: true } | { valid: false; reason: string } => {
    const definition = FILTERS.find(({ aliases }) => aliases.some(a => a === filterType))
    if (!definition) {
        return { valid: false, reason: 'Invalid filter type' }
    }
    if (definition.discreteValues && !definition.discreteValues.includes(filterValue)) {
        return {
            valid: false,
            reason: `Invalid filter value, expected one of: ${definition.discreteValues.join(', ')}`,
        }
    }
    return { valid: true }
}
