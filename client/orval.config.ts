import { defineConfig } from 'orval'

export default defineConfig({
  theMole: {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      target: './src/api/generated.ts',
      client: 'fetch',
      override: {
        mutator: {
          path: './src/api/fetcher.ts',
          name: 'fetcher',
        },
      },
    },
  },
})
