# web-clone

Recursively clone a website with url rewrite in controlled manner.

[![npm Package Version](https://img.shields.io/npm/v/web-clone)](https://www.npmjs.com/package/web-clone)

## Features

- Clone a website from cli
- Recursively discover same-site links
- Auto scroll to activate images with js-based lazy loading
- Review which links to download or skip
- Rewrite absolute urls into relative urls
- Support next.js image proxy (`/_next/image?url=xx&w=xx&q=xx`)

## Installation (optional)

You can install the package to lock the version:

```bash
npm i -g web-clone
# or
npm i -D web-clone
```

## Usage

Usage with installation:

```bash
npx web-clone
```

Usage without installation:

```bash
npx -y web-clone
```

## Environment Variables

The cli will ask for the variables interactively if they're not set.

The values are stored in `.env` file and auto restored in sub-sequence running.

Example setup:

```
SITE_DIR=./website
SITE_LIST_FILE=file-list.txt
CLONE_URL=https://example.net/
SCROLL_IN_DETAIL=false
```

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
