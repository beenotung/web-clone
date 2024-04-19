import { env, initConfig } from './env'
import { closeBrowser, scanWeb } from './web-clone'

async function main() {
  await initConfig()
  await scanWeb({
    dir: env.SITE_DIR,
    listFile: env.SITE_DIR,
    url: env.CLONE_URL,
    scrollInDetail: env.SCROLL_IN_DETAIL == 'true',
  })
  await closeBrowser()
}
main().catch(e => console.error(e))
