import * as vscode from "vscode";
import commands from "./commands";

let waystation: Record<string, unknown>;
export async function activate(context: vscode.ExtensionContext) {
  try {
    waystation = await commands.currentWaystation();

    let addMarkAtCursorCommand = vscode.commands.registerCommand(
      "vscode-waystation.addMarkAtCursor",
      async () => {
        const position = vscode.window.activeTextEditor?.selection.active;
        const line = Number(position!.line) + 1;
        const column = Number(position!.character) + 1;
        let path = vscode.window.activeTextEditor?.document.uri.path;
        if (path) {
          const context = vscode.window.activeTextEditor?.document.lineAt(
            line - 1,
          );
          await commands.addMark(path, line, column, context?.text);
          waystation = await commands.currentWaystation();
          if (WaystationPanel.currentPanel) {
            WaystationPanel.currentPanel.currentWaystation(waystation);
          }
        }
      },
    );

    let currentWaystationCommand = vscode.commands.registerCommand(
      "vscode-waystation.currentWaystation",
      async () => {
        WaystationPanel.createOrShow(context.extensionUri);
        if (WaystationPanel.currentPanel) {
          WaystationPanel.currentPanel.currentWaystation(waystation);
        }
        const interval = setInterval(async () => {
          if (WaystationPanel.currentPanel) {
            waystation = await commands.currentWaystation();
            WaystationPanel.currentPanel.currentWaystation(waystation);
            clearInterval(interval);
          }
        }, 500);
      },
    );

    let openWaystationCommand = vscode.commands.registerCommand(
      "vscode-waystation.openWaystation",
      async () => {
        const waystationList: Record<string, string>[] = await commands
          .listWaystations();
        const stationNames = waystationList.map(
          (station) => station.name,
        ).filter((name) => name !== "").filter((name) => name !== undefined);
        const pick = await vscode.window.showQuickPick(
          stationNames,
          {
            title: "Pick a station",
          },
        );
        const station = waystationList.find((station) => {
          return station.name === pick;
        });
        station && await commands.openWaystation(station.id);
        waystation = await commands.currentWaystation();
        if (WaystationPanel.currentPanel) {
          WaystationPanel.currentPanel.currentWaystation(waystation);
        }
      },
    );

    let newWaystationCommand = vscode.commands.registerCommand(
      "vscode-waystation.newWaystation",
      async () => {
        const waystationName = await vscode.window.showInputBox({
          title: "Waystation Name",
        });
        if (waystationName) {
          await commands.newWaystation(waystationName);
          waystation = await commands.currentWaystation();
        }
        if (WaystationPanel.currentPanel) {
          WaystationPanel.currentPanel.currentWaystation(waystation);
        }
      },
    );

    context.subscriptions.push(addMarkAtCursorCommand);
    context.subscriptions.push(currentWaystationCommand);
    context.subscriptions.push(newWaystationCommand);
    context.subscriptions.push(openWaystationCommand);
  } catch {
    console.error("Likely failed to parse way -j output ");
  }
}

export function deactivate() {}

function getWebviewOptions(
  extensionUri: vscode.Uri,
): vscode.WebviewOptions | vscode.WebviewPanelOptions {
  return {
    // Enable javascript in the webview
    enableScripts: true,
    retainContextWhenHidden: true,

    // And restrict the webview to only loading content from our extension's `assets` directory.
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "assets")],
  };
}

class WaystationPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: WaystationPanel | undefined;

  public static readonly viewType = "vscode-waystation.waystationPanel";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    // If we already have a panel, show it.
    // if (WaystationPanel.currentPanel) {
    //   WaystationPanel.currentPanel._panel.reveal(column);
    //   return;
    // }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      WaystationPanel.viewType,
      "Waystation",
      {
        viewColumn: vscode.ViewColumn.Two,
      },
      getWebviewOptions(extensionUri),
    );

    WaystationPanel.currentPanel = new WaystationPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WaystationPanel.currentPanel = new WaystationPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables,
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "waystation:update":
            commands.validateAndUpdateWaystation(message.waystation).then(
              (output) => {
                if (output.success) {
                  this.refreshWaystation(output.waystation);
                } else {
                  this.postError(output.error);
                }
              },
            );
            return;
          case "waystation:openDocument":
            const mark = JSON.parse(message.mark);
            const uri = vscode.Uri.file(mark.path);
            vscode.workspace.openTextDocument(uri).then((document) => {
              const range = document.lineAt(mark.line - 1).range;
              vscode.window.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.One,
                selection: range,
              });
            });
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public currentWaystation(waystation: Record<string, unknown>) {
    if (WaystationPanel.currentPanel) {
      WaystationPanel.currentPanel._panel.webview.postMessage({
        type: "waystation:current",
        waystation,
      });
    }
  }

  public refreshWaystation(waystation: Record<string, unknown>) {
    if (WaystationPanel.currentPanel) {
      WaystationPanel.currentPanel._panel.webview.postMessage({
        type: "waystation:refresh",
        waystation,
      });
    }
  }

  public postError(error: Record<string, unknown>) {
    if (WaystationPanel.currentPanel) {
      WaystationPanel.currentPanel._panel.webview.postMessage({
        type: "waystation:error",
        error,
      });
    }
  }

  public dispose() {
    WaystationPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = "Waystation";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const jsIndex = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "index.js"),
    );
    const cssIndex = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "index.css"),
    );
    const jsVendor = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "vendor.js"),
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite App</title>
    <link rel="stylesheet" href="${cssIndex}">
    <link rel="modulepreload" nonce="${nonce}" href="${jsVendor}">
    <script type="module" nonce="${nonce}" src="${jsIndex}"></script>
    </head>
    <body>
    <div id="app"></div>
  </body>
</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
