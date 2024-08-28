import { env, initConfig } from './env'
import { ExternalOriginStatus } from './list-file/external-origin'
import { pkg } from './pkg'
import { closeBrowser, scanWeb } from './web-clone'

async function main() {
  console.log(pkg.name, 'v' + pkg.version)
  await initConfig()
  console.log('Website Directory:', env.SITE_DIR)
  await scanWeb({
    dir: env.SITE_DIR,
    siteFileListFile: env.SITE_FILE_LIST,
    externalOriginListFile: env.EXTERNAL_ORIGIN_LIST,
    externalFileListFile: env.EXTERNAL_FILE_LIST,
    defaultExternalOriginStatus:
      env.DEFAULT_EXTERNAL_ORIGIN_STATUS as ExternalOriginStatus,
    url: env.CLONE_URL,
    scrollInDetail: env.SCROLL_IN_DETAIL == 'true',
  })
  await closeBrowser()
}
main().catch(e => console.error(e))
