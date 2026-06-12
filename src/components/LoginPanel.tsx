import { FormEvent, useState } from 'react';
import { Lock, LogIn } from 'lucide-react';

interface Props {
  appLabel: string;
  error: string | null;
  isSubmitting: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginPanel({ appLabel, error, isSubmitting, onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email.trim(), password);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Sign in to GM Script Library</h1>
          <p className="text-sm text-slate-500 mt-2">
            Production mode uses {appLabel} authentication. Anonymous users cannot manage operational script data.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="manager@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="PocketBase password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !email.trim() || !password}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogIn className="w-4 h-4" />
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-xs text-slate-600 leading-relaxed">
          Staff accounts should be linked to `gms_staff_members.authUserId` or matching staff email records so acknowledgements can be tied to the correct operational identity.
        </p>
      </form>
    </div>
  );
}
