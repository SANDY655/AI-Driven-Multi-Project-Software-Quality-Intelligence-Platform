import { Search, Filter, User, AlertTriangle, X, CheckSquare, Bug as BugIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface QuickFilterState {
    searchQuery: string
    onlyMyIssues: boolean
    highPriorityOnly: boolean
    unassignedOnly: boolean
    bugsOnly: boolean
    tasksOnly: boolean
    recentlyUpdated: boolean
}

interface JiraQuickFiltersBarProps {
    currentUserId?: string
    filters: QuickFilterState
    onFiltersChange: (filters: QuickFilterState) => void
    totalCount?: number
    filteredCount?: number
}

export function JiraQuickFiltersBar({
    currentUserId: _currentUserId,
    filters,
    onFiltersChange,
    totalCount,
    filteredCount
}: JiraQuickFiltersBarProps) {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFiltersChange({ ...filters, searchQuery: e.target.value })
    }

    const toggleFilter = (key: keyof QuickFilterState) => {
        onFiltersChange({
            ...filters,
            [key]: !filters[key]
        })
    }

    const clearAllFilters = () => {
        onFiltersChange({
            searchQuery: '',
            onlyMyIssues: false,
            highPriorityOnly: false,
            unassignedOnly: false,
            bugsOnly: false,
            tasksOnly: false,
            recentlyUpdated: false
        })
    }

    const hasActiveFilters =
        filters.searchQuery !== '' ||
        filters.onlyMyIssues ||
        filters.highPriorityOnly ||
        filters.unassignedOnly ||
        filters.bugsOnly ||
        filters.tasksOnly ||
        filters.recentlyUpdated

    return (
        <div className="bg-white border border-[#DFE1E6] rounded-md p-2.5 mb-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input & JQL Helper */}
            <div className="flex items-center gap-2 flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-[#6B778C] absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                    type="text"
                    value={filters.searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search issues, keys (e.g. SQIP-1), or type 'assignee:me'..."
                    className="pl-9 pr-8 h-9 text-sm border-[#DFE1E6] bg-[#F4F5F7] focus:bg-white focus:border-[#0747A6] transition-colors"
                />
                {filters.searchQuery && (
                    <button
                        onClick={() => onFiltersChange({ ...filters, searchQuery: '' })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B778C] hover:text-[#172B4D]"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Jira Filter Chips */}
            <div className="flex items-center flex-wrap gap-1.5 text-xs font-medium">
                <span className="text-[#6B778C] flex items-center gap-1 mr-1">
                    <Filter className="w-3.5 h-3.5" />
                    Quick Filters:
                </span>

                <button
                    onClick={() => toggleFilter('onlyMyIssues')}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 transition-colors border ${
                        filters.onlyMyIssues
                            ? 'bg-[#DEEBFF] text-[#0747A6] border-[#0747A6] font-semibold'
                            : 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                    }`}
                >
                    <User className="w-3 h-3" />
                    Only my issues
                </button>

                <button
                    onClick={() => toggleFilter('highPriorityOnly')}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 transition-colors border ${
                        filters.highPriorityOnly
                            ? 'bg-[#FFEBE6] text-[#DE350B] border-[#DE350B] font-semibold'
                            : 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                    }`}
                >
                    <AlertTriangle className="w-3 h-3" />
                    P0 / P1 High Priority
                </button>

                <button
                    onClick={() => toggleFilter('unassignedOnly')}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 transition-colors border ${
                        filters.unassignedOnly
                            ? 'bg-[#FFF0B3] text-[#172B4D] border-[#FFAB00] font-semibold'
                            : 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                    }`}
                >
                    Unassigned
                </button>

                <button
                    onClick={() => toggleFilter('bugsOnly')}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 transition-colors border ${
                        filters.bugsOnly
                            ? 'bg-[#FFEBE6] text-[#E53935] border-[#E53935] font-semibold'
                            : 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                    }`}
                >
                    <BugIcon className="w-3 h-3" />
                    Bugs
                </button>

                <button
                    onClick={() => toggleFilter('tasksOnly')}
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 transition-colors border ${
                        filters.tasksOnly
                            ? 'bg-[#E3F2FD] text-[#1E88E5] border-[#1E88E5] font-semibold'
                            : 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                    }`}
                >
                    <CheckSquare className="w-3 h-3" />
                    Tasks
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="h-7 px-2 text-[#0052CC] hover:underline font-semibold flex items-center gap-1 ml-1"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Filtered Count indicator */}
            {totalCount !== undefined && filteredCount !== undefined && (
                <div className="text-xs text-[#6B778C] whitespace-nowrap">
                    Showing <span className="font-bold text-[#172B4D]">{filteredCount}</span> of {totalCount}
                </div>
            )}
        </div>
    )
}

export function filterItems<T extends { title: string; description?: string; assigned_to?: string; priority?: string; bug_display_id?: string; task_display_id?: string; type?: string }>(
    items: T[],
    filters: QuickFilterState,
    currentUserId?: string
): T[] {
    return items.filter(item => {
        // Search query check
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase()
            const key = (item.bug_display_id || item.task_display_id || '').toLowerCase()
            const title = (item.title || '').toLowerCase()
            const desc = (item.description || '').toLowerCase()

            if (q === 'assignee:me') {
                if (item.assigned_to !== currentUserId) return false
            } else if (q.startsWith('priority:')) {
                const targetPrio = q.replace('priority:', '').toUpperCase()
                if ((item.priority || '').toUpperCase() !== targetPrio) return false
            } else if (!key.includes(q) && !title.includes(q) && !desc.includes(q)) {
                return false
            }
        }

        // Only my issues
        if (filters.onlyMyIssues && currentUserId) {
            if (item.assigned_to !== currentUserId) return false
        }

        // High priority check (P0, P1, high, critical)
        if (filters.highPriorityOnly) {
            const prio = (item.priority || '').toLowerCase()
            if (!['p0', 'p1', 'high', 'critical'].includes(prio)) return false
        }

        // Unassigned check
        if (filters.unassignedOnly) {
            if (item.assigned_to) return false
        }

        // Bugs only check
        if (filters.bugsOnly) {
            if (item.task_display_id) return false
        }

        // Tasks only check
        if (filters.tasksOnly) {
            if (item.bug_display_id) return false
        }

        return true
    })
}
