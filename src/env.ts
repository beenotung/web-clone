import { config } from 'dotenv'
import { readFileSync, writeFileSync } from 'fs'
import { ask } from 'npm-init-helper'
import populateEnv, { saveEnv } from 'populate-env'

config()

export let env = {
  WEB_CLONE_DIR: '',
  WEB_CLONE_LIST_FILE: '',
  WEB_CLONE_URL: '',
  WEB_CLONE_SCROLL_IN_DETAIL: '',
}

export async function initConfig() {
  try {
    populateEnv(env, { mode: 'error' })
    return
  } catch (error) {
    // missing env var
  }

  let defaultValue = './website'
  env.WEB_CLONE_DIR ||=
    (await ask(`directory of cloned website (default: ${defaultValue}): `)) ||
    defaultValue

  defaultValue = 'file-list.txt'
  env.WEB_CLONE_LIST_FILE ||=
    (await ask(`config file for status (default: ${defaultValue}): `)) ||
    defaultValue

  env.WEB_CLONE_URL ||= await ask(`url of website to clone: `)

  defaultValue = 'false'
  env.WEB_CLONE_SCROLL_IN_DETAIL ||=
    (await ask(`scroll in detail (default: ${defaultValue})? `)) || defaultValue

  saveEnv({ env })

  populateEnv(env, { mode: 'halt' })
}
