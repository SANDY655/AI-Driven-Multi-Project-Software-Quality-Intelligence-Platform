import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Bug, Eye, EyeOff } from 'lucide-react'

export function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

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
        <div className="min-h-screen bg-white flex flex-col md:flex-row w-full font-sans">

            {/* Left Side: Visual Splash */}
            <div className="w-full md:w-1/2 relative hidden md:block border-r border-zinc-100 min-h-screen">
                <img
                    src="/login_splash.png"
                    alt="Colorful abstract waves"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 lg:p-24">
                    <div className="flex items-center gap-2 mb-6 text-white/90">
                        <Bug className="w-8 h-8" />
                        <span className="font-bold text-xl drop-shadow-md">BugTracker</span>
                    </div>
                    <h1 className="text-white text-4xl lg:text-5xl font-serif font-bold leading-tight drop-shadow-lg max-w-sm">
                        Start your journey with us today
                    </h1>
                </div>
            </div>

            {/* Right Side: Register Form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 bg-white min-h-screen">
                <div className="w-full max-w-sm mx-auto">

                    {/* Mobile Header */}
                    <div className="flex items-center gap-2 mb-8 md:hidden text-zinc-900">
                        <Bug className="w-8 h-8 text-blue-600" />
                        <span className="font-bold text-xl">BugTracker</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-3xl font-extrabold text-zinc-900 mb-2 font-serif">Create an account</h2>
                        <p className="text-zinc-500 text-sm">Please fill in your details to get started.</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5" htmlFor="displayName">Full Name</label>
                            <input
                                id="displayName"
                                type="text"
                                required
                                className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-[12px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all text-sm"
                                placeholder="Enter your full name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>

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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-[12px] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-70 flex justify-center items-center mt-6"
                        >
                            {loading ? 'Signing up...' : 'Sign up'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-zinc-600">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-zinc-900 hover:underline">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>

        </div>
    )
}
