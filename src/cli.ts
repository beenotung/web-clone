import { env, initConfig } from './env'
import { closeBrowser, scanWeb } from './web-clone'

async function main() {
  await initConfig()
  await scanWeb({
    dir: env.WEB_CLONE_DIR,
    listFile: env.WEB_CLONE_LIST_FILE,
    url: env.WEB_CLONE_URL,
    scrollInDetail: env.WEB_CLONE_SCROLL_IN_DETAIL == 'true',
  })
  await closeBrowser()
}
main().catch(e => console.error(e))
