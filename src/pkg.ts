export let pkg: { name: string; version: string }

try {
  // dev mode
  pkg = require('../package.json')
} catch (error) {
  // release mode
  pkg = require('../../package.json')
}
