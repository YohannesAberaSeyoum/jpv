import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { select} from '@inquirer/prompts'
import fileSelector from 'inquirer-file-selector'
import { JpvFilePath } from "../db/schema/jpv.js";
import { fileURLToPath } from 'url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

// Define the directory where `.gitignore` templates are stored
const ignorePath = path.join(__dirname, "gitIgnore_templates");

// Helper function to fetch `.gitignore` templates
function getGitignoreTemplates(): string[] {
  if (!fs.existsSync(ignorePath)) {
    console.error(`Error: ${ignorePath} does not exist.`);
    return [];
  }
  return fs.readdirSync(ignorePath);
}

// Function to append entries to `.gitignore`
async function appendToGitignore(projectPath: string, templates: string[]) {
  const gitignorePath = path.join(projectPath, ".gitignore");
  const stream = fs.createWriteStream(gitignorePath, { flags: "a", encoding: "utf-8" });

  // Write an initial rule to ignore `.sh` files in the directory
  stream.write(`*${path.basename(projectPath)}.sh\n`);

  while (true) {
    const template = await select<string>(
      {
        message: "Select a .gitignore template or choose 'Finish':",
        choices: ["Finish", ...templates],
      },
    );

    if (template === "Finish") break;

    const templatePath = path.join(ignorePath, template);
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, "utf-8");
      stream.write(content);
    }
  }

  stream.end();
}

// Function to initialize a Git repository
function initializeGitRepo(directory: string): void {
  try {
    process.chdir(directory);
    execSync("git init");
    execSync("git add .");
    execSync("git commit -m 'git is initialized'");
    console.log(`Git initialized successfully in ${directory}`);
  } catch (error) {
    console.error(`Failed to initialize Git in ${directory}: ${error}`);
  } finally {
    process.chdir("..");
  }
}

// Function to process each directory for Git initialization
async function processDirectory(projectPath: string, templates: string[]) {
  const queue: string[] = [projectPath];

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const hasGit = dirs.includes(".git");

    if (hasGit) continue;

    console.log(`Processing: ${currentPath}`);

    const action = await select(
      {
        message: `Directory: ${currentPath}. What would you like to do?`,
        choices: [
          { name: "Initialize Git", value: "initialize" },
          { name: "Go deeper", value: "deeper" },
          { name: "Skip", value: "skip" },
        ],
      },
    );

    if (action === "initialize") {
      await appendToGitignore(currentPath, templates);
      initializeGitRepo(currentPath);
    } else if (action === "deeper") {
      queue.push(
        ...dirs.map((dir) => path.join(currentPath, dir))
      );
    }
  }
}

// Entry point for the script
export async function projectInit(jpvFilePath?: JpvFilePath) {
    let projectPath;
    if(!jpvFilePath){
        projectPath  = await fileSelector({
            message: "Enter the path to initialize Git:",
            type: 'directory'
          })
    } else {
        projectPath = jpvFilePath.pathUrl
    }

  const templates = getGitignoreTemplates();
  if (templates.length === 0) {
    console.log("No .gitignore templates found. Proceeding without templates.");
  }

  await processDirectory(projectPath, templates);
}

// // Run the script
// main().catch((error) => {
//   console.error(`An error occurred: ${error}`);
// });
