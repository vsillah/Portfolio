import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

async function main() {
  const { collectLiveSocialTopicCoverage } = await import('../../lib/social-topic-source-coverage')
  const coverage = await collectLiveSocialTopicCoverage({ persist: false })
  process.stdout.write(JSON.stringify({ coverage }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
