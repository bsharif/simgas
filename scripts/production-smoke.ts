import { spawn } from 'node:child_process'

const port = 4185
const child = spawn('npm', ['run', 'start'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let done = false

function finish(code: number, message?: string): void {
  if (done) return
  done = true
  child.kill()
  if (message) console.log(message)
  process.exit(code)
}

child.on('exit', code => {
  if (!done) finish(1, `server exited early with code ${code ?? 'unknown'}`)
})

const deadline = Date.now() + 10_000
async function poll(): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok && await response.text() === 'ok') {
        finish(0, '/health returned ok')
        return
      }
    } catch {
      // Server may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  finish(1, 'timed out waiting for /health')
}

void poll()
