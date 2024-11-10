import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('playlist_detail', () => {
  it('runs playlist_detail cmd', async () => {
    const {stdout} = await runCommand('playlist_detail')
    expect(stdout).to.contain('hello world')
  })

  it('runs playlist_detail --name oclif', async () => {
    const {stdout} = await runCommand('playlist_detail --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
