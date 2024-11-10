import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('channel', () => {
  it('runs channel cmd', async () => {
    const {stdout} = await runCommand('channel')
    expect(stdout).to.contain('hello world')
  })

  it('runs channel --name oclif', async () => {
    const {stdout} = await runCommand('channel --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
