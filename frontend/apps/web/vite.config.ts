import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css']

/**
 * Try to resolve `base + ext` for each extension.
 * Returns the first existing path, or null.
 */
function resolveWithExtensions(
  base: string,
): string | null {
  // 1. Check the exact path first (import may already include extension)
  if (fs.existsSync(base)) return base

  // 2. Try appending each extension
  for (const ext of extensions) {
    const p = base + ext
    if (fs.existsSync(p)) return p
  }

  // 3. Try as directory with index.*
  for (const ext of extensions) {
    const p = path.join(base, 'index' + ext)
    if (fs.existsSync(p)) return p
  }

  return null
}

/**
 * Resolves `@/*` and `@workspace/ui/*` imports with full extension
 * probing so Vite's load phase always gets a real file path.
 */
function workspaceAlias(): Plugin {
  const packages = [
    path.resolve(__dirname, '../virevo/src'),
    path.resolve(__dirname, './src'),
  ]
  const uiSrc = path.resolve(__dirname, '../../packages/ui/src')

  return {
    name: 'workspace-alias',
    enforce: 'pre',
    resolveId(source: string, importer: string | undefined) {
      if (!importer) return null

      // Vite may pass a relative importer — normalise to absolute
      const absImporter = path.resolve(importer)

      // --- @/ imports (context-aware) ---
      if (source.startsWith('@/')) {
        const pkgRoot = packages.find((p) =>
          absImporter.startsWith(p + '/'),
        )
        if (!pkgRoot) return null
        return resolveWithExtensions(
          path.resolve(pkgRoot, source.slice(2)),
        )
      }

      // --- @workspace/ui/* imports ---
      if (source.startsWith('@workspace/ui/')) {
        const sub = source.slice('@workspace/ui/'.length)

        // Exact export matches (mirrors package.json "exports")
        const exportMap: Record<string, string> = {
          'globals.css': 'styles/globals.css',
        }
        if (exportMap[sub]) {
          return resolveWithExtensions(
            path.resolve(uiSrc, exportMap[sub]),
          )
        }

        // Prefix export matches: components/*, lib/*, hooks/*
        const prefixMap: Record<string, string> = {
          components: 'components',
          lib: 'lib',
          hooks: 'hooks',
        }
        for (const [prefix, dir] of Object.entries(prefixMap)) {
          if (sub === prefix || sub.startsWith(prefix + '/')) {
            const rest = sub === prefix ? '' : sub.slice(prefix.length + 1)
            return resolveWithExtensions(
              path.resolve(uiSrc, dir, rest),
            )
          }
        }
      }

      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [workspaceAlias(), react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },
  server: {
    host: '0.0.0.0',
    port: 15179,
    proxy: {
      '/api': {
        target: 'http://localhost:13179',
        changeOrigin: true,
      },
    },
  }
})
