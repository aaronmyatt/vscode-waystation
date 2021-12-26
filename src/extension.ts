// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const WAYSTATION_TO_JSON_COMMAND = "way -j";
const WAYSTATION_ADD_MARK_COMMAND = "way mark";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  let waystation: Record<string, unknown>;
  const { stdout, stderr } = await exec(WAYSTATION_TO_JSON_COMMAND);

  try {
    waystation = JSON.parse(stdout);
  } catch {
    console.error(stderr);
  }

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "vscode-waystation.addMarkAtCursor",
    async () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      waystation && console.log(waystation);
      const position = vscode.window.activeTextEditor?.selection.active;
      const line = Number(position!.line) + 1;
      const column = Number(position!.character) + 1;
      let path = vscode.window.activeTextEditor?.document.uri.path;
      console.log(path);
      if (path) {
        const context = vscode.window.activeTextEditor?.document.lineAt(
          line - 1,
        );
        await exec(
          `${WAYSTATION_ADD_MARK_COMMAND} "${path}:${line}:${column}:${
            context && context.text
          }"`,
        );
      }
    },
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
