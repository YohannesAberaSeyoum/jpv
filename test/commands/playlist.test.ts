import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('playlist', () => {
  it('runs playlist cmd', async () => {
    const {stdout} = await runCommand('playlist')
    expect(stdout).to.contain('hello world')
  })

  it('runs playlist --name oclif', async () => {
    const {stdout} = await runCommand('playlist --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
