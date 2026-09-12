import { createSignal, Show } from 'solid-js';
import { GitHubIcon, WarningCircleIcon, CheckCircleIcon } from './Icons';
import { api, type GitHubUser } from '../lib/api';

interface ConnectGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GitHubUser | null;
  onAuthChange: () => void;
}

const buttonBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium leading-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondary = `${buttonBase} border-[#c9cccf] bg-white text-[#202223] hover:border-[#6d7175] hover:bg-[#f1f2f4] cursor-pointer`;
const buttonPrimary = `${buttonBase} border-[#005bd3] bg-[#005bd3] text-white hover:border-[#004bb5] hover:bg-[#004bb5] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer`;
const buttonDanger = `${buttonBase} border-[rgba(216,44,13,0.3)] bg-white text-[#d82c0d] hover:bg-[rgba(216,44,13,0.08)] cursor-pointer`;

export function ConnectGitHubModal(props: ConnectGitHubModalProps) {
  const [token, setToken] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleOpenTokenGen = async () => {
    const url =
      'https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=Pillar+Desktop';
    await api.openInBrowser(url);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const cleanToken = token().trim();
    if (!cleanToken) {
      setError('Please paste your GitHub Personal Access Token.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.saveGithubToken(cleanToken);
      setToken('');
      props.onAuthChange();
      props.onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to authenticate with GitHub.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.githubLogout();
      props.onAuthChange();
      props.onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to logout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
        <div class="w-full max-w-md bg-white border border-[#e1e3e5] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-5 text-[#202223] flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-[#e1e3e5] pb-3">
            <div class="flex items-center gap-2">
              <GitHubIcon size={18} class="text-[#202223]" />
              <h2 class="text-sm font-semibold text-[#202223]">
                {props.currentUser ? 'GitHub Account' : 'Connect to GitHub'}
              </h2>
            </div>
            <button
              onClick={props.onClose}
              class="text-[#6d7175] hover:text-[#202223] text-sm font-medium px-2 py-0.5 rounded hover:bg-[#f1f2f4] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <Show when={error()}>
            <div class="p-3 rounded-md bg-[rgba(216,44,13,0.08)] border border-[rgba(216,44,13,0.3)] text-[#d82c0d] text-xs leading-relaxed flex items-start gap-2">
              <WarningCircleIcon size={16} class="shrink-0 mt-0.5" />
              <span>{error()}</span>
            </div>
          </Show>

          <Show
            when={props.currentUser}
            fallback={
              <form onSubmit={handleSave} class="flex flex-col gap-4">
                <p class="text-xs text-[#6d7175] leading-relaxed">
                  Connect Pillar directly to GitHub to clone existing projects and publish new sites with one click. No third-party servers required.
                </p>

                <div class="rounded-lg bg-[#f6f6f7] border border-[#e1e3e5] p-3 text-xs flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-[#202223]">Personal Access Token</span>
                    <button
                      type="button"
                      onClick={handleOpenTokenGen}
                      class="text-[11.5px] text-[#005bd3] hover:underline font-medium cursor-pointer"
                    >
                      Generate token on GitHub ↗
                    </button>
                  </div>
                  <p class="text-[11.5px] text-[#6d7175] leading-normal m-0">
                    Required scopes: <code class="bg-[#e1e3e5] px-1 py-0.5 rounded text-[11px]">repo</code> and{' '}
                    <code class="bg-[#e1e3e5] px-1 py-0.5 rounded text-[11px]">read:user</code>.
                  </p>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-[#303030]">
                    Paste GitHub Token
                  </label>
                  <input
                    type="password"
                    value={token()}
                    onInput={(e) => setToken(e.currentTarget.value)}
                    placeholder="ghp_... or github_pat_..."
                    class="h-8 w-full rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[13px] text-[#202223] font-mono placeholder:text-[#8c9196] focus:border-[#005bd3] focus:ring-2 focus:ring-[#005bd3]/15 outline-none transition-colors"
                    required
                  />
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e1e3e5]">
                  <button
                    type="button"
                    onClick={props.onClose}
                    disabled={isSubmitting()}
                    class={buttonSecondary}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting() || !token().trim()}
                    class={buttonPrimary}
                  >
                    <Show when={isSubmitting()} fallback={<CheckCircleIcon size={14} />}>
                      <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </Show>
                    <span>{isSubmitting() ? 'Verifying…' : 'Connect Account'}</span>
                  </button>
                </div>
              </form>
            }
          >
            {(user) => (
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3 p-3 rounded-lg bg-[#f6f6f7] border border-[#e1e3e5]">
                  <img
                    src={user().avatar_url}
                    alt={user().login}
                    class="w-11 h-11 rounded-full border border-[#c9cccf]"
                  />
                  <div class="flex flex-col min-w-0">
                    <span class="font-semibold text-[13px] text-[#202223] truncate">
                      {user().name || user().login}
                    </span>
                    <span class="text-xs text-[#6d7175] truncate">
                      @{user().login}
                    </span>
                    <Show when={user().email}>
                      <span class="text-[11.5px] text-[#8c9196] truncate">
                        {user().email}
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-[#e1e3e5]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSubmitting()}
                    class={buttonDanger}
                  >
                    Disconnect Account
                  </button>
                  <button
                    type="button"
                    onClick={props.onClose}
                    class={buttonSecondary}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </Show>
  );
}
