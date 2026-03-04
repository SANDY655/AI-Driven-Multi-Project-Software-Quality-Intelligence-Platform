import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Mail, Lock, User, Bug, Github } from 'lucide-react'

export function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleGithubLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                scopes: 'repo',
            },
        })
        if (error) setError(error.message)
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    prompt: 'select_account',
                    ...(email ? { login_hint: email } : {}),
                },
            },
        })
        if (error) setError(error.message)
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Auto profile creation happens via DB trigger we set up.
        // We pass display_name in user_meta_data so the trigger can grab it.
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: displayName,
                },
            },
        })

        if (error) {
            setError(error.message)
        } else {
            // Sometimes SignUp requires email confirmation. For simplicity, assume auto-login if no confirmation needed.
            navigate('/')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col md:flex-row w-full font-sans">

            {/* Left Side: Register Form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-32 py-12 lg:py-0 relative z-10">
                <div className="w-full max-w-[380px] mx-auto">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-8 text-zinc-900 text-center">
                        <h2 className="text-[2.5rem] font-bold text-zinc-900 mb-1 tracking-tight leading-tight">Create an account</h2>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-zinc-800 mb-2 tracking-wide" htmlFor="displayName">Full Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <User className="h-[18px] w-[18px] text-zinc-400" />
                                </div>
                                <input
                                    id="displayName"
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200/80 rounded-xl text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                                    placeholder="John Doe"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-800 mb-2 tracking-wide" htmlFor="email">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-[18px] w-[18px] text-zinc-400" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200/80 rounded-xl text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                                    placeholder="johndoe@gmail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-800 mb-2 tracking-wide" htmlFor="password">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-[18px] w-[18px] text-zinc-400" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="w-full pl-10 pr-12 py-2.5 bg-white border border-zinc-200/80 rounded-xl text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] tracking-wider"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none flex items-center justify-center p-1"
                                >
                                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 pt-1">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-[#18181b] hover:bg-black text-white font-semibold rounded-xl shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-70 flex justify-center items-center mt-2"
                            >
                                {loading ? 'Signing up...' : 'Sign up'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 flex items-center justify-center space-x-4 mb-6">
                        <div className="flex-1 border-t border-zinc-200"></div>
                        <span className="text-sm text-zinc-400 font-medium tracking-wide">Or sign up with</span>
                        <div className="flex-1 border-t border-zinc-200"></div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button type="button" onClick={handleGoogleLogin} className="flex-1 h-[48px] flex items-center justify-center bg-white rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-all hover:border-zinc-300 shadow-sm">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={handleGithubLogin} className="flex-1 h-[48px] flex items-center justify-center bg-white rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-all hover:border-zinc-300 shadow-sm">
                            <Github className="w-5 h-5 text-[#181717]" />
                        </button>
                        <button type="button" className="flex-1 h-[48px] flex items-center justify-center bg-white rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-all hover:border-zinc-300 shadow-sm">
                            <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-6 text-center text-sm text-zinc-500">
                        Already have an account? <Link to="/login" className="font-bold text-zinc-900 hover:underline">Sign in here</Link>
                    </div>

                </div>
            </div>

            {/* Right Side: Visual Splash Container */}
            <div className="w-full md:w-1/2 hidden md:flex items-center justify-center p-6 lg:p-8">
                {/* Main Dark Card */}
                <div className="w-full h-full max-h-[92vh] bg-[#0c0c0e] rounded-[48px] relative overflow-hidden flex flex-col justify-end p-12 lg:p-16 shadow-2xl">

                    {/* Abstract 'A' Logo Graphic in Background */}
                    <div className="absolute inset-0 flex items-start justify-center pt-24 opacity-80 pointer-events-none">
                        <div className="relative w-80 h-80 lg:w-[400px] lg:h-[400px]">
                            <svg viewBox="0 0 100 100" className="w-full h-full text-[#1c1c1e] drop-shadow-2xl opacity-90">
                                <polygon points="50,10 90,90 10,90" fill="currentColor" />
                                <polygon points="50,25 75,80 25,80" fill="#0c0c0e" />
                                {/* Overlay polygon to create depth */}
                                <polygon points="50,40 62,68 38,68" fill="#2a2a2a" />
                            </svg>
                            {/* Decorative angled light rays */}
                            <div className="absolute top-[-50%] right-[-70%] w-[150%] h-[200px] bg-gradient-to-r from-transparent via-white/5 to-transparent transform rotate-45 blur-2xl"></div>
                            <div className="absolute top-[0%] right-[-50%] w-[150%] h-[5px] bg-gradient-to-r from-transparent via-white/10 to-transparent transform rotate-[35deg] blur-[1px]"></div>
                        </div>
                    </div>

                    {/* Left aligned content in the card */}
                    <div className="relative z-10 w-full max-w-lg">
                        <div className="flex flex-col items-center justify-center gap-4 mb-12 w-full">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-xl">
                                <Bug className="w-7 h-7 text-white" />
                            </div>
                            <span className="font-bold text-white tracking-wider text-xl">BugTracker</span>
                        </div>
                        <h2 className="text-white text-3xl lg:text-[2.5rem] font-bold mb-4 tracking-tight leading-tight">
                            Start your journey<br />with us today
                        </h2>
                        <p className="text-zinc-400 text-sm md:text-xs lg:text-sm max-w-[340px] mb-8 leading-relaxed">
                            BugTracker helps teams build secure, high-quality software with robust task management, multi-project workflows, and smart bug analytics. Join us today.
                        </p>
                        <p className="text-zinc-500 text-xs mb-16 lg:mb-24">
                            Join over 17k developers shipping better code faster
                        </p>
                    </div>

                    {/* Floating Sub-Card */}
                    <div className="absolute bottom-6 lg:bottom-8 right-6 lg:right-8 w-[240px] lg:w-[260px] bg-[#2d2d2f]/95 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl z-20">
                        <h3 className="text-white text-sm lg:text-base font-medium mb-1.5 leading-snug">
                            AI-Powered Quality<br />Intelligence
                        </h3>
                        <p className="text-zinc-400 text-[9px] lg:text-[10px] mb-3 leading-relaxed">
                            Elevate your software quality across all your projects with our advanced AI analytics and deep insights.
                        </p>
                        {/* Avatars */}
                        <div className="flex -space-x-1.5">
                            <img className="w-6 h-6 rounded-full border-[2px] border-[#2d2d2f]" src="https://ui-avatars.com/api/?name=Dev&background=0D8ABC&color=fff&font-size=0.4" alt="Developer" />
                            <img className="w-6 h-6 rounded-full border-[2px] border-[#2d2d2f]" src="https://ui-avatars.com/api/?name=QA&background=4CAF50&color=fff&font-size=0.4" alt="QA Engineer" />
                            <img className="w-6 h-6 rounded-full border-[2px] border-[#2d2d2f]" src="https://ui-avatars.com/api/?name=PM&background=FF9800&color=fff&font-size=0.4" alt="Product Manager" />
                            <div className="w-6 h-6 rounded-full border-[2px] border-[#2d2d2f] bg-zinc-800 flex items-center justify-center text-[8px] text-white font-semibold">
                                +2
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}
