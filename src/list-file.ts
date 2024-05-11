import { existsSync, writeFileSync, readFileSync, appendFileSync } from 'fs'

export type ListFileItem<Status> = {
  status: Status
  url: string
}

export class ListFile<Status extends string> {
  listFileHeader: string
  items: ListFileItem<Status>[]

  constructor(
    public options: { possible_status_list: Status[]; file: string },
  ) {
    let status = options.possible_status_list
    this.listFileHeader = `# possible status: ${status.join(', ')}`
    this.items = this.loadItemsFromFile()
  }

  loadItemsFromFile(): ListFileItem<Status>[] {
    let { file } = this.options
    if (!existsSync(file)) return []
    let items = readFileSync(file)
      .toString()
      .split('\n')
      // skip comment lines
      .filter(line => line[0] != '#')
      // example: 'pending https://www.example.net/'
      .map(line => line.trim().split(' '))
      .filter(parts => parts.length == 2)
      .map(parts => {
        return {
          status: parts[0] as any,
          url: parts[1].split('#')[0],
        }
      })
    return items
  }

  initFirstItem(item: ListFileItem<Status>) {
    let { url } = item
    let { items } = this

    let index = items.findIndex(item => item.url == url)
    if (index == -1) {
      items.unshift(item)
      this.saveToFile()
    } else if (index != 0) {
      let [item] = items.splice(index, 1)
      items.unshift(item)
      this.saveToFile()
    }
  }

  saveToFile() {
    let { file } = this.options
    let text =
      this.listFileHeader +
      '\n' +
      this.items.map(listFileItemToLine).join('\n') +
      '\n'
    writeFileSync(file, text)
  }

  add(newItem: ListFileItem<Status>) {
    let { file } = this.options
    let { items } = this
    if (items.some(item => item.url == newItem.url)) return
    items.push(newItem)
    appendFileSync(file, listFileItemToLine(newItem) + '\n')
    return true
  }

  findByStatus(status: Status) {
    return this.items.find(item => item.status == status)
  }
}

function listFileItemToLine(item: ListFileItem<string>): string {
  return `${item.status} ${item.url}`
}
