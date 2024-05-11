import { ListFile } from '../list-file'

export const ExternalOriginStatus = [
  'new',
  'inline',
  'preserve',
  'remove',
] as const
export type ExternalOriginStatus = (typeof ExternalOriginStatus)[number]

export function loadExternalOriginList(file: string) {
  return new ListFile({
    possible_status_list: ExternalOriginStatus,
    file,
  })
}
