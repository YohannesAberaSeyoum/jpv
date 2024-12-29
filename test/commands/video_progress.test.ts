import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('video_progress', () => {
  it('runs video_progress cmd', async () => {
    const {stdout} = await runCommand('video_progress')
    expect(stdout).to.contain('hello world')
  })

  it('runs video_progress --name oclif', async () => {
    const {stdout} = await runCommand('video_progress --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
