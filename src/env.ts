import { config } from 'dotenv'
import { ask } from 'npm-init-helper'
import populateEnv, { saveEnv } from 'populate-env'
import { ExternalOriginStatus } from './list-file/external-origin'

config()

export let env = {
  SITE_DIR: '',
  SITE_FILE_LIST: '',
  EXTERNAL_ORIGIN_LIST: '',
  EXTERNAL_FILE_LIST: '',
  DEFAULT_EXTERNAL_ORIGIN_STATUS: '',
  CLONE_URL: '',
  SCROLL_IN_DETAIL: '',
}

export async function initConfig() {
  try {
    populateEnv(env, { mode: 'error' })
    return
  } catch (error) {
    // missing env var
  }

  env.CLONE_URL ||= await ask(`url of website to clone: `)

  let defaultValue = './website'
  env.SITE_DIR ||=
    (await ask(`directory of cloned website (default: ${defaultValue}): `)) ||
    defaultValue

  defaultValue = 'true'
  env.SCROLL_IN_DETAIL ||=
    (await ask(`scroll in detail (default: ${defaultValue})? `)) || defaultValue

  defaultValue = 'file-list.txt'
  env.SITE_FILE_LIST ||=
    (await ask(`status file for site files (default: ${defaultValue}): `)) ||
    defaultValue

  defaultValue = 'external-origin-list.txt'
  env.EXTERNAL_ORIGIN_LIST ||=
    (await ask(
      `status file for external origins (default: ${defaultValue}): `,
    )) || defaultValue

  defaultValue = 'external-file-list.txt'
  env.EXTERNAL_FILE_LIST ||=
    (await ask(
      `status file for external files (default: ${defaultValue}): `,
    )) || defaultValue

  defaultValue = 'new'
  env.DEFAULT_EXTERNAL_ORIGIN_STATUS ||=
    (await ask(
      `default status for external origin (${ExternalOriginStatus.join(
        ' | ',
      )}) (default: ${defaultValue}): `,
    )) || defaultValue
  if (
    !ExternalOriginStatus.includes(env.DEFAULT_EXTERNAL_ORIGIN_STATUS as any)
  ) {
    console.error(
      `Invalid DEFAULT_EXTERNAL_ORIGIN_STATUS, current: ${
        env.DEFAULT_EXTERNAL_ORIGIN_STATUS
      }, expected: ${ExternalOriginStatus.join(' | ')}`,
    )
    env.DEFAULT_EXTERNAL_ORIGIN_STATUS = ''
    saveEnv({ env })
    process.exit(1)
  }

  saveEnv({ env })

  populateEnv(env, { mode: 'halt' })
}
