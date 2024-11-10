import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('mpv', () => {
  it('runs mpv cmd', async () => {
    const {stdout} = await runCommand('mpv')
    expect(stdout).to.contain('hello world')
  })

  it('runs mpv --name oclif', async () => {
    const {stdout} = await runCommand('mpv --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
