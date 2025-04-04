import * as core from '@actions/core'
import * as github from '@actions/github'
import handlebars from 'handlebars'
import { Inputs } from './inputs.js'
import * as fs from 'fs/promises'

async function getTemplateContent(templateInput?: string): Promise<string> {
  let templateContent: string
  if (templateInput && templateInput.trim().length > 0) {
    try {
      // Try to read the file at the given path
      templateContent = await fs.readFile(templateInput, 'utf8')
      core.info(`Loaded template from file: ${templateInput}`)
    } catch {
      // If reading the file fails, treat the input as an inline template
      core.info('Using inline template.')
      templateContent = templateInput
    }
  } else {
    // Load the default template from your bundled file
    templateContent = await fs.readFile(
      new URL('../templates/default-template.hbs', import.meta.url),
      'utf8'
    )
    core.info('Loaded default template.')
  }
  return templateContent
}

async function run(): Promise<void> {
  try {
    // Read inputs from environment variables
    const inputs = new Inputs()

    // Parse the JSON result
    const trivyRaw = await fs.readFile(inputs.trivyResults, 'utf-8')
    const trivyResults = JSON.parse(trivyRaw)

    // Check if the "Results" array exists and is not empty
    if (!trivyResults.Results || trivyResults.Results.length === 0) {
      core.warning('Trivy scan is empty. Stopping...')
      return
    }
    // Check if any of the results have vulnerabilities
    const vulnerabilitiesExist = trivyResults.Results.some((result) => {
      // Ensure that Vulnerabilities exists and that it has at least one item
      return result.Vulnerabilities && result.Vulnerabilities.length > 0
    })

    if (!vulnerabilitiesExist) {
      core.info('No vulnerabilities found. Stopping...')
      return
    }

    // Load and compile the template (custom or default)
    const rawTemplate = await getTemplateContent(inputs.template)
    const compiledTemplate = handlebars.compile(rawTemplate)

    // Here we pass the trivyResults under a key that the default template expects,
    // e.g., 'Results'. Adjust this as necessary for your template.
    const commentBody = compiledTemplate(trivyResults)

    if (commentBody.length === 0) {
      core.setFailed(
        'The template returned no data, this usually means the template is not reverencing the results correctly.'
      )
      return
    }

    // Initialize octokit with the provided token
    const octokit = github.getOctokit(inputs.token)
    const context = github.context

    if (!context.payload.pull_request) {
      core.setFailed('This action can only be run on pull_request events.')
      return
    }

    if (inputs.dryRun) {
      core.info('Comment Body:' + commentBody)
      return
    } else {
      // Post the comment to the pull request
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.pull_request.number,
        body: commentBody
      })

      core.info('Comment posted successfully.')
    }
  } catch (error: unknown) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

run()
