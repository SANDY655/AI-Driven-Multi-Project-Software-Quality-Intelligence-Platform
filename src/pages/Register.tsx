import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Github, Bug } from 'lucide-react'

export function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                }
            }
        })

        if (error) {
            setError(error.message)
        } else if (data.user) {
            navigate('/')
        }
        setLoading(false)
    }

    const handleGithubLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                scopes: 'repo',
            },
        })
        if (error) setError(error.message)
    }

    return (
        <div className="min-h-screen bg-[#FAFBFC] flex flex-col items-center justify-center p-4">
            
            <div className="w-full max-w-[400px] bg-white rounded shadow-[0_4px_8px_rgba(9,30,66,0.25)] border border-[#DFE1E6] p-8">
                
                <div className="flex flex-col items-center mb-8">
                    <div className="w-10 h-10 bg-[#0052CC] rounded flex items-center justify-center mb-4 shadow-sm">
                        <Bug className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-[#172B4D] text-[18px] font-semibold text-center">Sign up for an account</h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                        <div className="bg-[#FFEBE6] border border-[#DE350B] text-[#DE350B] px-3 py-2 rounded text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div>
                        <input
                            id="fullName"
                            type="text"
                            required
                            className="w-full px-3 py-2 bg-[#FAFBFC] border border-[#DFE1E6] rounded text-[#172B4D] placeholder-[#A5ADBA] focus:outline-none focus:border-[#4C9AFF] focus:bg-white transition-colors text-sm"
                            placeholder="Enter full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div>
                        <input
                            id="email"
                            type="email"
                            required
                            className="w-full px-3 py-2 bg-[#FAFBFC] border border-[#DFE1E6] rounded text-[#172B4D] placeholder-[#A5ADBA] focus:outline-none focus:border-[#4C9AFF] focus:bg-white transition-colors text-sm"
                            placeholder="Enter email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <input
                            id="password"
                            type="password"
                            required
                            className="w-full px-3 py-2 bg-[#FAFBFC] border border-[#DFE1E6] rounded text-[#172B4D] placeholder-[#A5ADBA] focus:outline-none focus:border-[#4C9AFF] focus:bg-white transition-colors text-sm"
                            placeholder="Create password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white font-medium rounded text-sm transition-colors focus:outline-none disabled:opacity-70 mt-4"
                    >
                        {loading ? 'Creating account...' : 'Sign up'}
                    </button>
                </form>

                <div className="my-6 text-center text-sm text-[#5E6C84]">OR</div>

                <button 
                    type="button" 
                    onClick={handleGithubLogin} 
                    className="w-full py-2 flex items-center justify-center bg-white border border-[#DFE1E6] hover:bg-[#FAFBFC] rounded text-[#172B4D] font-medium transition-colors text-sm gap-2"
                >
                    <Github className="w-4 h-4 text-[#172B4D]" />
                    Continue with GitHub
                </button>

                <div className="mt-6 pt-6 border-t border-[#DFE1E6] text-center text-sm">
                    <Link to="/login" className="text-[#0052CC] hover:underline font-medium">Already have an account? Log in</Link>
                </div>

            </div>
            <div className="mt-8 text-center">
                <span className="text-[#5E6C84] text-[24px] font-bold tracking-widest opacity-20">BugTracker</span>
            </div>
        </div>
    )
}
