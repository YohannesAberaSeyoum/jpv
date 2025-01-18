import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('tutorial_project', () => {
  it('runs tutorial_project cmd', async () => {
    const {stdout} = await runCommand('tutorial_project')
    expect(stdout).to.contain('hello world')
  })

  it('runs tutorial_project --name oclif', async () => {
    const {stdout} = await runCommand('tutorial_project --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
