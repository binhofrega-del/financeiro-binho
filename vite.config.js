/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Versão exibida no app: número do package.json + data/hora do build + commit.
// O número você muda à mão (ex.: 1.1.0 → 1.2.0); data e commit são automáticos.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function commitCurto() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7) // GitHub Actions
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return '' }
}

const dataBuild = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date()).replace(',', '')

// Gera o service worker (sw/sw.js) com a versão do build — muda a cada deploy,
// e é isso que faz o celular perceber que há versão nova.
function serviceWorker(versao) {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle() {
      const fonte = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf-8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: fonte.replace('__VERSAO__', versao) });
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), serviceWorker(`${pkg.version}-${commitCurto() || Date.now()}-${Date.now()}`)],
  base: '/financeiro-binho/', // nome do repositório no GitHub
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_BUILD_DATA': JSON.stringify(command === 'serve' ? 'teste local' : dataBuild),
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commitCurto()),
  },
}))
