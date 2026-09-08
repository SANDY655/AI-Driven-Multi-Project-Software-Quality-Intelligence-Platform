import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TrendingDown, Activity, BarChart3, Loader2 } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#DE350B', // Jira highest
  high: '#FF5630',   // Jira high
  medium: '#FFAB00', // Jira medium
  low: '#0065FF'     // Jira low
}

export function SprintAnalytics() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<any>(null)
  const [sprints, setSprints] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      
      const [projRes, sprintRes, taskRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('sprints').select('*').eq('project_id', id).order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').eq('project_id', id)
      ])

      if (projRes.data) setProject(projRes.data)
      if (sprintRes.data) setSprints(sprintRes.data)
      if (taskRes.data) setTasks(taskRes.data)
      
      setLoading(false)
    }
    loadData()
  }, [id])

  if (loading) {
      return (
          <div className="flex flex-1 items-center justify-center bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-[#0052CC]" />
          </div>
      )
  }

  if (!project) {
      return (
          <div className="flex items-center justify-center h-full w-full bg-white text-[#DE350B] font-medium">
              Could not load project data.
          </div>
      )
  }

  // 1. Priority Distribution Data
  const priorityCount = tasks.reduce((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const priorityData = Object.keys(priorityCount).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: priorityCount[key],
    color: PRIORITY_COLORS[key] || '#5E6C84'
  }))

  // 2. Velocity Data (Sprints)
  const velocityData = sprints.map(s => {
    const sprintTasks = tasks.filter(t => t.sprint_id === s.id)
    const completedTasks = sprintTasks.filter(t => t.status === 'done')
    return {
      name: s.name,
      Planned: sprintTasks.length,
      Completed: completedTasks.length
    }
  })

  // 3. Simulated Burndown Data for the Active Sprint
  const activeSprint = sprints.find(s => s.status === 'active') || sprints[sprints.length - 1]
  const activeSprintTasks = activeSprint ? tasks.filter(t => t.sprint_id === activeSprint.id) : []
  
  const totalTasks = activeSprintTasks.length
  const completedTasksCount = activeSprintTasks.filter(t => t.status === 'done').length
  const remainingToday = totalTasks - completedTasksCount

  const burndownData = Array.from({ length: 14 }).map((_, i) => {
    const ideal = totalTasks - (totalTasks / 13) * i
    
    const currentDay = 7
    let actual: number | null = null
    if (i <= currentDay) {
        const drop = (totalTasks - remainingToday) / currentDay
        actual = totalTasks - (drop * i)
        if (i === currentDay) actual = remainingToday
        if (i === 0) actual = totalTasks
    }

    return {
      day: `Day ${i + 1}`,
      Ideal: Math.max(0, ideal),
      Actual: actual !== null ? Math.max(0, actual) : null
    }
  })

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-white overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex-shrink-0">
        <div className="flex items-center text-sm text-[#5E6C84] mb-2">
            <Link to="/projects" className="hover:underline">Projects</Link>
            <span className="mx-2">/</span>
            <Link to={`/projects/${id}`} className="hover:underline">{project.name}</Link>
            <span className="mx-2">/</span>
            <span className="text-[#172B4D]">Reports</span>
        </div>
        <div className="flex justify-between items-end">
            <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">
                Analytics
            </h1>
        </div>
      </div>

      <div className="max-w-6xl px-8 w-full space-y-8 pb-12">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded border border-[#DFE1E6] p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded bg-[#DEEBFF] flex items-center justify-center text-[#0052CC]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider">Total Tasks</p>
              <h3 className="text-2xl font-medium text-[#172B4D]">{tasks.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded border border-[#DFE1E6] p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded bg-[#E3FCEF] flex items-center justify-center text-[#006644]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider">Total Sprints</p>
              <h3 className="text-2xl font-medium text-[#172B4D]">{sprints.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded border border-[#DFE1E6] p-5 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 rounded bg-[#FFFAE6] flex items-center justify-center text-[#FF8B00]">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider">Sprint Completion</p>
              <h3 className="text-2xl font-medium text-[#172B4D]">
                {totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0}%
              </h3>
            </div>
          </div>
        </div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Burndown Chart */}
          <div className="bg-white border border-[#DFE1E6] rounded p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-[#DFE1E6] pb-3">
              <h2 className="text-[16px] font-medium text-[#172B4D]">Sprint Burndown</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" minHeight={300}>
                <LineChart data={burndownData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBECF0" />
                  <XAxis dataKey="day" stroke="#5E6C84" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5E6C84" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '3px', border: '1px solid #DFE1E6', boxShadow: '0 4px 8px -2px rgba(9,30,66,0.25)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="Ideal" stroke="#A5ADBA" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="Actual" stroke="#DE350B" strokeWidth={2} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="bg-white border border-[#DFE1E6] rounded p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-[#DFE1E6] pb-3">
              <h2 className="text-[16px] font-medium text-[#172B4D]">Task Priority Distribution</h2>
            </div>
            <div className="h-[300px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" minHeight={300}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '3px', border: '1px solid #DFE1E6', boxShadow: '0 4px 8px -2px rgba(9,30,66,0.25)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-8">
                <span className="text-2xl font-medium text-[#172B4D]">{tasks.length}</span>
                <span className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider">Tasks</span>
              </div>
            </div>
          </div>

          {/* Velocity Chart */}
          <div className="bg-white border border-[#DFE1E6] rounded p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 mb-6 border-b border-[#DFE1E6] pb-3">
              <h2 className="text-[16px] font-medium text-[#172B4D]">Sprint Velocity</h2>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBECF0" vertical={false} />
                  <XAxis dataKey="name" stroke="#5E6C84" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5E6C84" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: '#FAFBFC' }}
                    contentStyle={{ borderRadius: '3px', border: '1px solid #DFE1E6', boxShadow: '0 4px 8px -2px rgba(9,30,66,0.25)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Planned" fill="#DFE1E6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Completed" fill="#006644" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
