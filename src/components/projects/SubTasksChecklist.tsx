import { useState, useEffect } from 'react'
import { CheckSquare, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react'

export interface SubTaskItem {
    id: string
    title: string
    completed: boolean
}

interface SubTasksChecklistProps {
    issueId: string
    initialItems?: SubTaskItem[]
    onUpdate?: (items: SubTaskItem[]) => void
}

export function SubTasksChecklist({ issueId, initialItems, onUpdate }: SubTasksChecklistProps) {
    const storageKey = `subtasks_${issueId}`
    const [items, setItems] = useState<SubTaskItem[]>(() => {
        if (initialItems && initialItems.length > 0) return initialItems
        const saved = localStorage.getItem(storageKey)
        if (saved) {
            try { return JSON.parse(saved) } catch { return [] }
        }
        return [
            { id: '1', title: 'Write unit tests & check edge cases', completed: false },
            { id: '2', title: 'Code review & PR approval', completed: true }
        ]
    })

    const [newItemTitle, setNewItemTitle] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(items))
        if (onUpdate) onUpdate(items)
    }, [items, storageKey])

    function toggleItem(id: string) {
        setItems(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item))
    }

    function addItem() {
        if (!newItemTitle.trim()) return
        const newItem: SubTaskItem = {
            id: Date.now().toString(),
            title: newItemTitle.trim(),
            completed: false
        }
        setItems(prev => [...prev, newItem])
        setNewItemTitle('')
        setIsAdding(false)
    }

    function deleteItem(id: string) {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    const completedCount = items.filter(i => i.completed).length
    const totalCount = items.length
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
        <div className="border border-[#DFE1E6] rounded-[3px] overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-[#DFE1E6] bg-[#FAFBFC] font-semibold text-[13px] text-[#172B4D] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#0052CC]" />
                    <span>Sub-tasks & Checklist</span>
                    <span className="text-[11px] font-bold text-[#5E6C84] bg-[#DFE1E6] px-1.5 py-0.5 rounded-full">
                        {completedCount}/{totalCount}
                    </span>
                </div>

                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="text-[11px] font-semibold bg-[#DEEBFF] hover:bg-[#0052CC] hover:text-white text-[#0052CC] px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" />
                        Add item
                    </button>
                )}
            </div>

            <div className="p-3 space-y-3">
                {/* Progress Bar */}
                {totalCount > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#5E6C84]">
                            <span>Checklist Progress</span>
                            <span className="font-bold text-[#00875A]">{pct}% Done</span>
                        </div>
                        <div className="h-1.5 bg-[#DFE1E6] rounded-full overflow-hidden">
                            <div className="h-full bg-[#00875A] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                )}

                {/* Items List */}
                {items.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-[#5E6C84] bg-[#F4F5F7] rounded">
                        No sub-tasks added yet. Click <strong>+ Add item</strong> above.
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between group p-1.5 hover:bg-[#FAFBFC] rounded transition-colors">
                                <button 
                                    onClick={() => toggleItem(item.id)}
                                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                                >
                                    {item.completed ? (
                                        <CheckCircle2 className="w-4 h-4 text-[#00875A] flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-[#A5ADBA] flex-shrink-0" />
                                    )}
                                    <span className={`text-[12px] text-[#172B4D] truncate ${item.completed ? 'line-through text-[#5E6C84]' : 'font-medium'}`}>
                                        {item.title}
                                    </span>
                                </button>

                                <button 
                                    onClick={() => deleteItem(item.id)}
                                    className="text-[#A5ADBA] hover:text-[#DE350B] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Delete sub-task"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Inline Add Input */}
                {isAdding && (
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Add sub-task item..."
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setIsAdding(false) }}
                            className="flex-1 border border-[#0052CC] rounded px-2 py-1 text-[12px] outline-none bg-white"
                        />
                        <button onClick={addItem} className="text-[11px] bg-[#0052CC] text-white px-2.5 py-1 rounded font-semibold">Save</button>
                        <button onClick={() => setIsAdding(false)} className="text-[11px] text-[#5E6C84]">Cancel</button>
                    </div>
                )}
            </div>
        </div>
    )
}
