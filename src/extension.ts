import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "templates" is now active!');

	// create templates folder if it doesn't exist
	const templatesFolder = path.join(context.extensionPath, 'templates');
	if (!fs.existsSync(templatesFolder)) {
		fs.mkdirSync(templatesFolder);
	}

	// create extnames file if they don't exist
	const extNamesPath = path.join(__dirname, 'extnames.json');
	if (!fs.existsSync(extNamesPath)) {
		fs.writeFileSync(extNamesPath, "{}");
	}
	const extNames = JSON.parse(fs.readFileSync(extNamesPath, 'utf8'));

	// create output channel
	var output = vscode.window.createOutputChannel('Templates');
	function getOutput() {
		if (!output) {
			output = vscode.window.createOutputChannel('Templates');
		}
		return output;
	}

	function createTemplate(template: string, filePath: string | undefined, output: vscode.OutputChannel) {
		output.appendLine(`Creating template ${template} using ${filePath} file...`);
		// check file exists
		if (filePath === undefined || !fs.existsSync(filePath)) {
			if(vscode.window.activeTextEditor) {
				filePath = vscode.window.activeTextEditor.document.fileName;
				output.appendLine(`No file found, using active file ${filePath}`);
			} else {
				vscode.window.showErrorMessage(`File ${filePath} does not exist`);
				output.appendLine(`File ${filePath} does not exist`);
				return;
			}
		}
		// check does not template exists already
		let savePath = path.join(templatesFolder, template);
		if (fs.existsSync(savePath)) {
			vscode.window.showErrorMessage(`Template ${template} already exists`);
			output.appendLine(`Template ${template} already exists`);
			return;
		}
		// copy template to extension folder
		output.appendLine(`Copying template ${template} from ${filePath} to ${savePath}`);
		fs.writeFileSync(savePath, fs.readFileSync(filePath));
		extNames[template] = path.extname(filePath);
		fs.writeFileSync(extNamesPath, JSON.stringify(extNames, null, 4));
		vscode.window.showInformationMessage(`Template ${template} created`);
		output.appendLine(`Template ${template} created`);
	}

	function removeTemplate(template: string, output: vscode.OutputChannel) {
		output.appendLine(`Removing template ${template}...`);

		let savePath = path.join(templatesFolder, template);
		output.appendLine(`template file path ${savePath}`);
		if (fs.existsSync(savePath)) {
			fs.unlinkSync(savePath);
			delete extNames[template];
			fs.writeFileSync(extNamesPath, JSON.stringify(extNames, null, 4));
			output.appendLine(`Template ${template} removed`);
		} else {
			output.appendLine(`Template ${template} does not exist`);
		}
		vscode.window.showInformationMessage(`Template ${template} removed`);
	}

	function getTemplates() {
		let templates = fs.readdirSync(templatesFolder);
		templates.forEach((template, index) => {
			templates[index] = path.basename(template);
		});
		return templates;
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let create = vscode.commands.registerCommand('templates.create', async () => {
		// Get ouptput channel
		let output = getOutput();
		output.clear();
		output.appendLine('Creating template...');

		// input template name
		let template = await vscode.window.showInputBox({
			placeHolder: 'Template name',
			prompt: 'Enter template name'
		});

		if (template) {
			output.appendLine(`Template name: ${template}`);
			let filePath = undefined;
			if(vscode.window.activeTextEditor) {
				filePath = vscode.window.activeTextEditor.document.fileName;
				output.appendLine(`Using active file ${filePath} as template`);
			} else {
				output.appendLine(`No active file`);
				filePath = await vscode.window.showInputBox({
					prompt: 'Enter file absolute path',
					placeHolder: 'Enter file absolute path'
				});
				output.appendLine(`Using file ${filePath} as template`);
			}
			createTemplate(template, filePath, output);
		} else {
			output.appendLine(`Template ${template} not created`);
			vscode.window.showErrorMessage('Template name is required');
		}
	});

	let load = vscode.commands.registerCommand('templates.load', async () => {
		// Get ouptput channel
		let output = getOutput();
		output.clear();
		output.appendLine(`Loading template...`);

		// select template
		let templates = getTemplates();
		output.appendLine(`Available templates: ${templates}`);
		let template = await vscode.window.showQuickPick(templates, {
			placeHolder: 'Select template to load'
		});

		//
		if (template) {
			output.appendLine(`Selected template: ${template}`);
			let filePath = path.join(templatesFolder, template);
			output.appendLine(`Loading template ${template} from ${filePath}`);
			if (fs.existsSync(filePath)) {
				// select file
				if (!vscode.window.activeTextEditor) {
					output.appendLine(`No active file, prompting user to select file`);
					let targetFile = await vscode.window.showInputBox({
						prompt: 'Enter target absolute path',
						placeHolder: 'Enter target absolute path'
					});
					if (targetFile) {
						output.appendLine(`opening file ${targetFile}`);
						var doc = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetFile));
					} else {
						output.appendLine(`No file selected`);
						vscode.window.showErrorMessage('Target file is required');
						return;
					}
				} else {
					var doc = await vscode.window.activeTextEditor;
				}

				output.appendLine(`Loading template ${template} to ${doc.document.fileName}`);

				// doc is not empty
				if (doc.document.getText() !== '') {
					output.appendLine(`File ${doc.document.fileName} is not empty`);
					let erase = await vscode.window.showInformationMessage('Erase current content?', 'Yes', 'No');
					if (erase === 'No') {
						return;
					}
					output.appendLine(`${doc.document.fileName} will be erased`);
				}

				// check file extension
				let ext = path.extname(doc.document.fileName);
				if (ext !== extNames[template as string]) {
					output.appendLine(`File ${doc.document.fileName} and template ${template} have different extensions`);
					output.appendLine(`Template extension: ${extNames[template as string]}`);
					output.appendLine(`File extension: ${ext}`);

					let cont = await vscode.window.showWarningMessage(
						`File extension ${ext} is different from template ${extNames[template as string]}. Continue anyway?`,
						'Yes', 'No');
					if (cont === 'No') {
						return;
					}
				}

				// load template
				let res = await doc.edit(edit => {
					edit.replace(new vscode.Range(0, 0, doc.document.lineCount, 0), fs.readFileSync(filePath).toString());
				});
				
				if (res) {
					output.appendLine(`Template ${template} loaded to ${doc.document.fileName}`);
					vscode.window.showInformationMessage(`Template ${template} loaded`);
				} else {
					output.appendLine(`Template ${template} not loaded`);
					vscode.window.showErrorMessage(`Template ${template} not loaded`);
				}
			} else {
				output.appendLine(`Template ${template} not found`);
				vscode.window.showErrorMessage(`Template ${template} not found`);
			}
		} else {
			output.appendLine("No template selected, aborting");
		}
	});

	let remove = vscode.commands.registerCommand('templates.remove', async () => {
		// Get ouptput channel
		let output = getOutput();
		output.clear();
		output.appendLine(`Removing template...`);

		// select template
		let templates = getTemplates();
		output.appendLine(`Available templates: ${templates}`);
		let template = await vscode.window.showQuickPick(templates, {
			placeHolder: 'Select template to remove'
		});

		//
		if (template) {
			output.appendLine(`Selected template: ${template}`);
			removeTemplate(template, output);
		} else {
			output.appendLine("No template selected, aborting");
			vscode.window.showErrorMessage('Template name is required');
		}
	} );

	let edit = vscode.commands.registerCommand('templates.edit', async () => {
		// Get ouptput channel
		let output = getOutput();
		output.clear();
		output.appendLine(`Editing template...`);

		// select template
		let templates = getTemplates();
		output.appendLine(`Available templates: ${templates}`);
		let template = await vscode.window.showQuickPick(templates, {
			placeHolder: 'Select template to edit'
		});

		//
		if (template) {
			output.appendLine(`Selected template: ${template}`);
			let filePath = path.join(templatesFolder, template);
			output.appendLine(`Template to be edited: ${filePath}`);
			if (fs.existsSync(filePath)) {
				output.appendLine(`Opening file ${filePath}`);
				let doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
				
				// const content = doc.getText();
				// // check when template is closing
				// vscode.workspace.onDId.onDidCloseTextDocument(async doc => {
				// 	if (content !== doc.getText()) {
				// 		let save = await vscode.window.showInformationMessage(`Save template ${template} changes?`, 'Yes', 'No');
				// 		if (save === 'No') {
				// 			fs.writeFileSync(filePath, content);
				// 		} 
				// 	}
				// } );
			} else {
				output.appendLine(`file ${filePath} not found`);
				vscode.window.showErrorMessage(`Template ${template} not found`);
			}
		} else {
			vscode.window.showErrorMessage('Template name is required');
		}
	} );

	let list = vscode.commands.registerCommand('templates.list', async () => {
		// Get ouptput channel
		let output = getOutput();
		output.clear();
		output.appendLine(`Listing templates...`);

		// get templates
		let templates = getTemplates();
		output.appendLine(`Available templates: ${templates}`);

		// dump templates to console
		output.appendLine(`Templates:`);
		templates.forEach(t => {
			output.appendLine(`- ${t}	${extNames[t as string]}`);
		});
		output.show();

		// let filename = path.join(__dirname, "templates.json");
		
		// output.appendLine(`Dumping templates to ${filename}`);
		// fs.writeFileSync(filename, JSON.stringify(templates, null, 4));

		// output.appendLine(`open ${filename}`);
		// await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(filename));
	} );

	context.subscriptions.push(create);
	context.subscriptions.push(load);
	context.subscriptions.push(remove);
	context.subscriptions.push(edit);
	context.subscriptions.push(list);
}

// this method is called when your extension is deactivated
export function deactivate() {}
