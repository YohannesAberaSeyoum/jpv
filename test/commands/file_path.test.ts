import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('file_path', () => {
  it('runs file_path cmd', async () => {
    const {stdout} = await runCommand('file_path')
    expect(stdout).to.contain('hello world')
  })

  it('runs file_path --name oclif', async () => {
    const {stdout} = await runCommand('file_path --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
