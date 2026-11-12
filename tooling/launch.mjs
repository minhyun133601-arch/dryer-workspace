import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorkspaceServer, preferredPort, installShutdown } from './serve.mjs';

export function openBrowser(url, { argv = process.argv, platform = process.platform, spawnBrowser = spawn } = {}) {
  if (argv.includes('--no-browser')) return Promise.resolve(false);
  const windows = platform === 'win32';
  const [command, args] = windows
    ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`]]
    : platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  return new Promise((resolve) => {
    const browser = spawnBrowser(command, args, { stdio: 'ignore', windowsHide: true, ...(windows ? { windowsVerbatimArguments: true } : {}) });
    const fallback = () => { console.log(`브라우저 주소창에 ${url} 을 입력해 주세요.`); resolve(false); };
    browser.once('error', fallback);
    // On a repeated CMD launch the process can finish immediately. Let Windows
    // hand the URL to the default browser before that launcher exits.
    if (windows) browser.once('exit', (code) => code === 0 ? resolve(true) : fallback());
    else browser.once('spawn', () => { browser.unref(); resolve(true); });
  });
}

export async function launchWorkspace({ argv = process.argv, port = preferredPort(), stateFile, open = (url) => openBrowser(url, { argv }) } = {}) {
  const result = await startWorkspaceServer({ port, stateFile });
  const { server, reused, url } = result;
  const moduleArgument = argv.find((argument) => argument.startsWith('--module='));
  const moduleId = moduleArgument?.slice('--module='.length);
  const browserUrl = moduleId && /^[a-z][a-z\d-]*$/.test(moduleId) ? `${url}/#/${moduleId}` : url;
  if (server) {
    installShutdown(server);
    console.log(`\n건조기 통합 작업실을 시작했습니다.\n${url}\n`);
    console.log('종료하려면 이 창에서 Ctrl+C를 누르세요.');
  } else if (reused) console.log(`이미 실행 중인 건조기 통합 작업실을 엽니다.\n${url}`);
  await open(browserUrl);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await launchWorkspace();
  } catch (error) {
    console.error(`통합 작업실을 시작하지 못했습니다: ${error.message}`);
    process.exitCode = 1;
  }
}
