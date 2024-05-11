import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { basename, dirname, extname, join } from 'path'
import 'playwright'
import { Page, chromium, Request, Browser } from 'playwright'
import { Readable } from 'stream'
import { finished } from 'stream/promises'

let browserPromise: Promise<Browser> | undefined

function getBrowser(): Promise<Browser> {
  browserPromise ||= chromium.launch({ headless: false })
  return browserPromise
}

export async function scanWeb(options: {
  dir: string
  listFile: string
  url: string
  scrollInDetail: boolean
  browser?: Browser
}) {
  let { dir, listFile } = options
  let items = loadListFile(listFile, options.url)
  let browser = options.browser || (await getBrowser())
  let page = await browser.newPage()
  for (;;) {
    let item = items.find(item => item.status == 'pending')
    if (!item) break
    await downloadPage({
      dir,
      url: item.url,
      scrollInDetail: options.scrollInDetail,
      page,
      onPageLink: url => {
        addToFileList({
          file: listFile,
          items: items,
          url,
        })
      },
    })
    item.status = 'saved'
    saveFileList(listFile, items)
  }
  await page.close()
}

export async function closeBrowser() {
  let p = browserPromise?.then(browser => browser.close())
  browserPromise = undefined
  return p
}

type FileStatus = 'new' | 'pending' | 'saved' | 'skip'

let listFileHeader = `# possible status: new, pending, skip, saved`

type ListFileItem = {
  status: FileStatus
  url: string
}

function listFileItemToLine(item: ListFileItem): string {
  return `${item.status} ${item.url}`
}

function loadListFile(file: string, url: string): ListFileItem[] {
  let list: ListFileItem[]
  if (!existsSync(file)) {
    list = [{ status: 'pending', url }]
    writeFileSync(
      file,
      listFileHeader + '\n' + listFileItemToLine(list[0]) + '\n',
    )
    return list
  }
  list = readFileSync(file)
    .toString()
    .split('\n')
    // example: 'pending https://www.example.net/'
    .map(line => line.trim().split(' '))
    .filter(parts => parts.length == 2)
    .map(parts => {
      return {
        status: parts[0] as any,
        url: parts[1].split('#')[0],
      }
    })
  let index = list.findIndex(item => item.url == url)
  if (index == -1) {
    list.unshift({ status: 'pending', url })
    saveFileList(file, list)
  } else if (index != 0) {
    let [item] = list.splice(index, 1)
    list.unshift(item)
    saveFileList(file, list)
  }
  return list
}

function saveFileList(file: string, list: ListFileItem[]) {
  let text =
    listFileHeader + '\n' + list.map(listFileItemToLine).join('\n') + '\n'
  writeFileSync(file, text)
}

function addToFileList(options: {
  file: string
  items: ListFileItem[]
  url: string
}) {
  let { file, items, url } = options
  if (items.some(item => item.url == url)) return
  console.log('add page link:', url)
  let item: ListFileItem = { status: 'new', url }
  items.push(item)
  appendFileSync(file, listFileItemToLine(item) + '\n')
}

let resourceExtnameList = [
  '.css',
  '.js',
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
  page: Page
  onPageLink: (url: string) => void
}) {
  let { dir, page } = options
  let origin = new URL(options.url).origin
  let file = pathnameToFile({ origin, dir, url: options.url })
  // if (existsSync(file)) return
  console.log('download page:', options.url)
  let saved = false
  async function onRequest(req: Request) {
    if (req.method() != 'GET') return
    let href = req.url().split('#')[0]
    if (href == options.url) return
    let url = new URL(href)
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
      if (saved) {
        await savePage()
      }
      return
    }
    console.log('unknown ext:', ext, 'url:', url.href)
  }
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

  let resLinks = await page.evaluate(
    ({ webProtocols, external_resource_prefix }) => {
      let links: string[] = []
      function checkLink(
        link: string | undefined,
        updateFn: (rewritten_url: string) => void,
      ): void {
        if (!link) return
        let url = new URL(link)
        if (!webProtocols.includes(url.protocol)) return
        links.push(link)
        if (url.origin == location.origin) return
        let rewritten_url = link.replace(
          url.origin,
          `/${external_resource_prefix}/${url.host.replace(':', '_')}`,
        )
        updateFn(rewritten_url)
      }
      document
        .querySelectorAll<HTMLImageElement>('img,video,audio,script')
        .forEach(node => {
          checkLink(node.src, src => (node.src = src))

          let lazySrc = node.dataset.lazySrc
          if (lazySrc?.[0] == '/') {
            lazySrc = location.origin + lazySrc
          }
          checkLink(lazySrc, src => (node.dataset.lazySrc = src))
        })
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
        .forEach(node => {
          checkLink(node.href, href => (node.href = href))
        })
      return links
    },
    { webProtocols, external_resource_prefix },
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
    let html = await page.evaluate(() => {
      return (
        '<!DOCTYPE html>\n' +
        document.documentElement.outerHTML.replaceAll(
          location.origin + '/',
          '/',
        )
      )
    })
    console.log('save page:', options.url)
    saveFile(file, html)
  }
  await savePage()
  saved = true
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
  let pathname = url.pathname
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
