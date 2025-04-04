import * as core from '@actions/core'

export class Inputs {
  token: string
  trivyResults: string
  template: string | undefined
  dryRun: boolean

  constructor() {
    this.token = core.getInput('token', { required: true })
    this.trivyResults = core.getInput('trivy-results', { required: true })
    this.template = core.getInput('template')
    this.dryRun = core.getInput('dry-run').toLowerCase() === 'true' || false // Initialize dryRun
  }
}
