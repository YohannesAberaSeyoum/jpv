import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('video', () => {
  it('runs video cmd', async () => {
    const {stdout} = await runCommand('video')
    expect(stdout).to.contain('hello world')
  })

  it('runs video --name oclif', async () => {
    const {stdout} = await runCommand('video --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
