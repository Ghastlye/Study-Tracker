import { useState } from 'react';

export default function AuthForm({ onSubmit, mode = 'login', loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const title = mode === 'login' ? 'Login' : 'Create account';

  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email, password);
      }}
    >
      <h1 className="text-xl font-medium text-[var(--text)]">{title}</h1>
      <input
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        minLength={6}
        required
      />
      <button
        className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-[var(--accent-contrast)] transition disabled:opacity-50"
        type="submit"
        disabled={loading}
      >
        {loading ? 'Please wait...' : title}
      </button>
    </form>
  );
}
