import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { Page, chromium, Request, Browser } from 'playwright'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import { ListFile } from './list-file'
import {
  ExternalOriginStatus,
  loadExternalOriginList,
} from './list-file/external-origin'
import { loadSiteFileList } from './list-file/site-file'

let browserPromise: Promise<Browser> | undefined

function getBrowser(): Promise<Browser> {
  browserPromise ||= chromium.launch({ headless: false })
  return browserPromise
}

export async function scanWeb(options: {
  dir: string
  siteFileListFile: string
  externalOriginListFile: string
  externalFileListFile: string
  defaultExternalOriginStatus: ExternalOriginStatus
  url: string
  scrollInDetail: boolean
  browser?: Browser
}) {
  let { dir } = options
  let siteFileList = loadSiteFileList(options.siteFileListFile, options.url)
  let externalSiteList = loadExternalOriginList(options.externalOriginListFile)
  let browser = options.browser || (await getBrowser())
  let page = await browser.newPage()
  for (;;) {
    let item = siteFileList.findByStatus('pending')
    if (!item) break
    let { newExternalOrigins, pendingResLinks } = await downloadPage({
      dir,
      url: item.url,
      scrollInDetail: options.scrollInDetail,
      externalOriginList: externalSiteList,
      defaultExternalOriginStatus: options.defaultExternalOriginStatus,
      page,
      onPageLink: url => {
        url = decodeURI(url)
        if (siteFileList.add({ status: 'new', url })) {
          console.log('new page link:', url)
        }
      },
    })
    for (let origin of newExternalOrigins) {
      if (
        externalSiteList.add({
          status: options.defaultExternalOriginStatus,
          url: origin,
        })
      ) {
        if (options.defaultExternalOriginStatus == 'new') {
          console.log('new external site:', origin)
        }
      }
    }
    if (
      newExternalOrigins.length > 0 &&
      options.defaultExternalOriginStatus == 'new'
    ) {
      writeFileSync(
        options.externalFileListFile,
        pendingResLinks.join('\n') + '\n',
      )
      console.log(
        pendingResLinks.length,
        'pending external resources listed in file:',
        options.externalFileListFile,
      )
      console.log(
        newExternalOrigins.length,
        'new external origin(s), please review them in file:',
        options.externalOriginListFile,
      )
      await page.close()
      return
    }
    item.status = 'saved'
    siteFileList.saveToFile()
  }
  let newFiles = siteFileList.filterByStatus('new')
  if (newFiles.length > 0) {
    console.log(
      newFiles.length,
      'new page link(s), please review them in file:',
      options.siteFileListFile,
    )
  } else {
    console.log('downloaded all pages')
  }
  await page.close()
}

export async function closeBrowser() {
  let p = browserPromise?.then(browser => browser.close())
  browserPromise = undefined
  return p
}

let resourceExtnameList = [
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.svg',
  '.png',
  '.jpeg',
  '.jpg',
  '.webp',
  '.webm',
  '.gif',
  '.mp3',
  '.mp4',
  '.json',
  '.pdf',
]

// skip protocol of 'chrome-extension:' and 'blob:'
let webProtocols = ['http:', 'https:']

async function downloadPage(options: {
  dir: string
  url: string
  scrollInDetail: boolean
  externalOriginList: ListFile<ExternalOriginStatus>
  defaultExternalOriginStatus: ExternalOriginStatus
  page: Page
  onPageLink: (url: string) => void
}) {
  let { dir, externalOriginList, page } = options
  let origin = new URL(options.url).origin
  let file = pathnameToFile({ origin, dir, url: options.url })
  // if (existsSync(file)) return
  console.log('download page:', options.url)
  let saved = false
  async function onRequest(req: Request) {
    if (stopped) return
    if (req.method() != 'GET') return
    let href = req.url().split('#')[0]
    if (href == options.url) return
    let url = new URL(href)
    // FIXME: auto include external resources?
    if (url.origin !== origin) return
    if (!webProtocols.includes(url.protocol)) return
    let pathname = url.pathname
    if (
      pathname.endsWith('/') ||
      pathname.endsWith('.html') ||
      pathname.endsWith('.php')
    ) {
      // another html page
      return options.onPageLink(url.href)
    }
    let ext = extname(pathname)
    if (resourceExtnameList.includes(ext)) {
      await downloadFile({ origin, dir, url: url.href })
      if (stopped) return
      if (saved) {
        await savePage()
      }
      return
    }
    console.log('unknown ext:', ext, 'url:', url.href)
  }
  let stopped = false
  page.on('request', onRequest)
  await page.goto(options.url, { waitUntil: 'domcontentloaded' })
  if (options.scrollInDetail) {
    console.log('scrolling page:', options.url)
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        let visited = new Set()
        loop()
        function loop() {
          let nodes = document.querySelectorAll('body *')
          let i = 0
          let hasNew = false
          tick()
          function tick() {
            for (; i < nodes.length; ) {
              let node = nodes[i]
              i++
              if (visited.has(node)) continue
              visited.add(node)
              hasNew = true
              node.scrollIntoView({ behavior: 'instant' })
              requestAnimationFrame(tick)
              return
            }
            if (hasNew) {
              loop()
            } else {
              resolve()
            }
          }
        }
      })
    })
  } else {
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        Array.from(document.querySelectorAll('body *'), node => ({
          node,
          top: node.getBoundingClientRect().top,
        }))
          .sort((a, b) => b.top - a.top)[0]
          .node.scrollIntoView({ behavior: 'smooth' })
        let smoothScrollDelay = 1000
        setTimeout(resolve, smoothScrollDelay)
      })
    })
  }
  page.off('request', onRequest)
  stopped = true

  // convert to relative link
  await page.evaluate(() => {
    document.querySelectorAll<HTMLAnchorElement>('[href]').forEach(link => {
      let href = link.href
      if (new URL(href).origin != location.origin) return
      link.setAttribute('href', href.replace(location.origin, ''))
    })
    document.querySelectorAll<HTMLImageElement>('[src]').forEach(link => {
      let href = link.src
      if (new URL(href).origin != location.origin) return
      link.setAttribute('src', href.replace(location.origin, ''))
    })
  })

  // remove favicon if not relative link
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"][type="image/x-icon"]',
      )
      .forEach(link => {
        let href = link.href
        if (new URL(href).origin != location.origin) {
          link.remove()
        }
      })
  })

  let { resLinks, pendingResLinks, newExternalOrigins } = await page.evaluate(
    ({
      webProtocols,
      external_resource_prefix,
      externalSiteList,
      defaultExternalOriginStatus,
    }) => {
      let resLinks: string[] = []
      let pendingResLinks: string[] = []
      let newExternalOrigins = new Set<string>()
      function checkLink(options: {
        href: string | undefined
        update(rewritten_url: string): void
        node: HTMLElement
      }): void {
        let link = options.href
        if (!link) return

        let url = new URL(link)
        if (!webProtocols.includes(url.protocol)) return

        if (url.origin != location.origin) {
          let status =
            externalSiteList.find(item => item.url == url.origin)?.status ||
            defaultExternalOriginStatus
          switch (status) {
            case 'preserve':
              return
            case 'remove':
              options.node.remove()
              return
            case 'new':
              newExternalOrigins.add(url.origin)
              pendingResLinks.push(link)
              return
            case 'inline':
              let rewritten_url = link.replace(
                url.origin,
                `/${external_resource_prefix}/${url.host.replace(':', '_')}`,
              )
              options.update(rewritten_url)
              break
            default:
              let x: never = status
              throw new Error('unknown external origin status: ' + x)
          }
        }

        // same-origin or inlined external-origin resource
        resLinks.push(link)
      }
      document
        .querySelectorAll<HTMLImageElement>('img,video,audio,script')
        .forEach(node => {
          checkLink({
            href: node.src,
            update: src => (node.src = src),
            node,
          })

          let lazySrc = node.dataset.lazySrc
          if (lazySrc?.[0] == '/') {
            lazySrc = location.origin + lazySrc
          }
          checkLink({
            href: lazySrc,
            update: src => (node.dataset.lazySrc = src),
            node,
          })
        })
      document
        .querySelectorAll<HTMLLinkElement>(
          'link[rel="stylesheet"],link[rel*="icon"]',
        )
        .forEach(node => {
          checkLink({
            href: node.href,
            update: src => (node.href = src),
            node,
          })
        })
      return {
        resLinks,
        pendingResLinks,
        newExternalOrigins: Array.from(newExternalOrigins),
      }
    },
    {
      webProtocols,
      external_resource_prefix,
      externalSiteList: externalOriginList.items,
      defaultExternalOriginStatus: options.defaultExternalOriginStatus,
    },
  )
  let pageLinks = await page.evaluate(() => {
    let links = new Set<string>()
    document.querySelectorAll('a').forEach(a => {
      let link = a.href
      if (!link) return
      if (new URL(link).origin != location.origin) return
      let href = link.replace(location.origin, '')
      if (a.getAttribute('href') !== href) {
        a.setAttribute('href', href)
      }
      link = link.split('#')[0]
      links.add(link)
    })
    return Array.from(links)
  })
  for (let link of pageLinks) {
    if (link == options.url) continue
    let ext = extname(new URL(link).pathname)
    if (resourceExtnameList.includes(ext)) {
      resLinks.push(link)
      continue
    }
    options.onPageLink(link)
  }
  for (let link of resLinks) {
    await downloadFile({ origin, dir, url: link })
  }
  async function savePage() {
    let html = await page
      .evaluate(() => {
        return (
          '<!DOCTYPE html>\n' +
          document.documentElement.outerHTML.replaceAll(
            location.origin + '/',
            '/',
          )
        )
      })
      .catch(err => {
        if (String(err).includes('has been closed')) {
          return ''
        }
        throw err
      })
    if (!html) return
    console.log('save page:', options.url)
    saveFile(file, html)
  }
  await savePage()
  saved = true

  return { newExternalOrigins, pendingResLinks }
}

async function downloadFile(options: {
  origin: string
  dir: string
  url: string
}) {
  let file = pathnameToFile(options)
  if (existsSync(file)) return
  console.log('download file:', options.url)
  let res = await fetch(options.url)
  mkdirForFile(file)
  let stream = createWriteStream(file)
  await finished(Readable.fromWeb(res.body as any).pipe(stream))
}

function saveFile(file: string, content: string | Buffer) {
  mkdirForFile(file)
  writeFileSync(file, content)
}

function mkdirForFile(file: string) {
  let dir = dirname(file)
  mkdirSync(dir, { recursive: true })
}

let external_resource_prefix = '__extern__'

function pathnameToFile(options: { origin: string; dir: string; url: string }) {
  let url = new URL(options.url)
  let pathname = decodeURI(url.pathname)
  if (pathname.endsWith('/')) {
    pathname += 'index.html'
  } else if (extname(basename(pathname)) == '') {
    pathname += '/index.html'
  }
  let dir =
    url.origin == options.origin
      ? options.dir
      : join(options.dir, external_resource_prefix, url.host.replace(':', '_'))
  return join(dir, pathname)
}
