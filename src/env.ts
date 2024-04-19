import { config } from 'dotenv'
import { readFileSync, writeFileSync } from 'fs'
import { ask } from 'npm-init-helper'
import populateEnv, { saveEnv } from 'populate-env'

config()

export let env = {
  SITE_DIR: '',
  SITE_FILE_LIST: '',
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

  let defaultValue = './website'
  env.SITE_DIR ||=
    (await ask(`directory of cloned website (default: ${defaultValue}): `)) ||
    defaultValue

  defaultValue = 'file-list.txt'
  env.SITE_FILE_LIST ||=
    (await ask(`config file for status (default: ${defaultValue}): `)) ||
    defaultValue

  env.CLONE_URL ||= await ask(`url of website to clone: `)

  defaultValue = 'false'
  env.SCROLL_IN_DETAIL ||=
    (await ask(`scroll in detail (default: ${defaultValue})? `)) || defaultValue

  saveEnv({ env })

  populateEnv(env, { mode: 'halt' })
}
