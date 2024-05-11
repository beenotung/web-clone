import { ListFile } from '../list-file'

export const SiteFileStatus = ['new', 'pending', 'saved', 'skip'] as const

export function loadSiteFileList(file: string, url: string) {
  let list = new ListFile({
    possible_status_list: SiteFileStatus,
    file,
  })
  list.initFirstItem({ status: 'pending', url })
  return list
}
