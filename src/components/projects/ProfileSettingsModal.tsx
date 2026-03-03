import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, User2, Mail, Github, ShieldAlert } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface Profile {
    display_name: string
    avatar_url: string | null
    role: string
    github_username: string | null
}

interface ProfileSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    user: User | null
    profile: Profile | null
}

export function ProfileSettingsModal({ isOpen, onClose, user, profile }: ProfileSettingsModalProps) {
    if (!user) return null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[32px] bg-white p-8 text-left align-middle shadow-xl transition-all border border-zinc-200">
                                <div className="flex justify-between items-center mb-8">
                                    <Dialog.Title as="h3" className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                                        <User2 className="h-5 w-5 text-zinc-400" />
                                        Profile Settings
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 p-2 rounded-full transition-colors outline-none"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="flex flex-col items-center mb-8">
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="h-24 w-24 rounded-full ring-4 ring-zinc-50 shadow-md object-cover mb-4" />
                                    ) : (
                                        <div className="h-24 w-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-3xl ring-4 ring-zinc-50 shadow-md mb-4">
                                            {(profile?.display_name || user.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <h4 className="text-xl font-bold text-zinc-900">{profile?.display_name || 'User'}</h4>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mt-2 ring-1 ring-inset ring-blue-600/20 capitalize">
                                        <ShieldAlert className="h-3 w-3" />
                                        {profile?.role || 'User'}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-sm text-zinc-500">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-xs font-medium text-zinc-500">Email Address</span>
                                            <span className="text-sm font-semibold text-zinc-800 truncate">{user.email}</span>
                                        </div>
                                    </div>

                                    {profile?.github_username && (
                                        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
                                            <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-sm text-zinc-500">
                                                <Github className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-xs font-medium text-zinc-500">GitHub Profile</span>
                                                <span className="text-sm font-semibold text-zinc-800 truncate">@{profile.github_username}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <button
                                        type="button"
                                        className="w-full inline-flex justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none transition-colors"
                                        onClick={onClose}
                                    >
                                        Close
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
