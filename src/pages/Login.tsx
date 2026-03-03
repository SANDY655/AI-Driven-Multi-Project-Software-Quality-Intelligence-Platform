import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Github, Bug } from 'lucide-react'

export function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
        } else {
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
        <div className="min-h-screen bg-white flex flex-col md:flex-row w-full font-sans">

            {/* Left Side: Visual Splash */}
            <div className="w-full md:w-1/2 relative hidden md:block border-r border-zinc-100 min-h-screen">
                <img
                    src="/login_splash.png"
                    alt="Colorful abstract waves"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12">
                    <div className="flex items-center gap-2 mb-6 text-white/90">
                        <Bug className="w-8 h-8" />
                        <span className="font-bold text-xl drop-shadow-md">BugTracker</span>
                    </div>
                    <h1 className="text-white text-4xl lg:text-5xl font-serif font-bold leading-tight drop-shadow-lg max-w-sm">
                        Get Everything You Want
                    </h1>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 bg-white">
                <div className="w-full max-w-sm mx-auto">

                    {/* Mobile Header */}
                    <div className="flex items-center gap-2 mb-8 md:hidden text-zinc-900">
                        <Bug className="w-8 h-8 text-blue-600" />
                        <span className="font-bold text-xl">BugTracker</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-3xl font-extrabold text-zinc-900 mb-2 font-serif">Welcome back</h2>
                        <p className="text-zinc-500 text-sm">Please enter your details to sign in.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-[12px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all text-sm"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5" htmlFor="password">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-[12px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all text-sm pr-12"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none flex items-center justify-center p-1"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-1">
                            <label className="flex items-center cursor-pointer group">
                                <input type="checkbox" className="rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 w-4 h-4 cursor-pointer" />
                                <span className="ml-2 text-zinc-600 group-hover:text-zinc-900 transition-colors font-medium">Remember me</span>
                            </label>
                            <a href="#" className="font-semibold text-zinc-900 hover:underline">
                                Forgot password?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-[12px] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-70 flex justify-center items-center mt-6"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center space-x-4">
                        <div className="flex-1 border-t border-zinc-200"></div>
                        <span className="text-sm text-zinc-500 font-medium">Or</span>
                        <div className="flex-1 border-t border-zinc-200"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGithubLogin}
                        className="mt-6 w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-[12px] hover:bg-zinc-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-200 shadow-sm"
                    >
                        <Github className="w-5 h-5" />
                        Sign in with GitHub
                    </button>

                    <p className="mt-8 text-center text-sm text-zinc-600">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-semibold text-zinc-900 hover:underline">
                            Sign up for free
                        </Link>
                    </p>
                </div>
            </div>

        </div>
    )
}
