import * as vscode from 'vscode';

interface TodoItem {
    text: string;
    file: string;
    line: number;
    tag: string;
    urgency: number; 
}

export function activate(context: vscode.ExtensionContext) {
    const todoTreeProvider = new TodoTreeProvider();
    vscode.window.registerTreeDataProvider('betterTodosView', todoTreeProvider);

    const colors: { [key: string]: string } = {
        'TODO': '#ffcc00',
        'FIXME': '#ff6666',
        'HACK': '#ff8800',
        'NOTE': '#66ccff',
        'REVIEW': '#cc88ff',
        'OPTIMIZE': '#ff99cc',
        'DO ZROBIENIA': '#ffcc00',
        'POPRAW': '#ff6666',
        'UWAGA': '#ffaa00',
        'POMYŚL': '#88ffaa'
    };

    const decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {};

    Object.keys(colors).forEach(tag => {
        decorationTypes[tag] = vscode.window.createTextEditorDecorationType({
            color: colors[tag],
            fontWeight: 'bold',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    });

    function updateDecorations(editor: vscode.TextEditor | undefined) {
        if (!editor) return;

        Object.keys(decorationTypes).forEach(tag => {
            const regex = new RegExp(`\\b${tag}\\b.*`, 'gi');
            const matches: vscode.DecorationOptions[] = [];
            const text = editor.document.getText();

            let match;
            while ((match = regex.exec(text)) !== null) {
                const startPos = editor.document.positionAt(match.index);
                const endPos = editor.document.positionAt(match.index + match[0].length);
                matches.push({ range: new vscode.Range(startPos, endPos) });
            }

            editor.setDecorations(decorationTypes[tag], matches);
        });
    }

    vscode.window.onDidChangeActiveTextEditor(editor => updateDecorations(editor));
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor?.document === event.document) {
            updateDecorations(vscode.window.activeTextEditor);
        }
        todoTreeProvider.refresh();
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('better-todos.addTodo', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const tag = await vscode.window.showQuickPick(
                ['TODO', 'FIXME', 'NOTE', 'HACK', 'REVIEW', 'DO ZROBIENIA', 'POPRAW'],
                { placeHolder: 'Wybierz tag' }
            );

            if (!tag) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Opis zadania'
            });

            const line = editor.selection.active.line;
            const text = `// ${tag}: ${description || '...'}`;

            editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(line, 0), text + '\n');
            });
        })
    );

    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }

    console.log('✅ Better Todos & Comments jest aktywne!');
}

class TodoTreeProvider implements vscode.TreeDataProvider<TodoItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TodoItem | undefined | null | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<TodoItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TodoItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);
        item.description = `${element.file} • linia ${element.line + 1}`;
        item.command = {
            command: 'vscode.open',
            title: 'Otwórz',
            arguments: [
                vscode.Uri.file(element.file),
                { selection: new vscode.Range(element.line, 0, element.line, 0) }
            ]
        };
        return item;
    }

    async getChildren(): Promise<TodoItem[]> {
        const todos: TodoItem[] = [];
        const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,go,rust,cpp,cs,php,html,css}');

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();

            const regex = /\b(TODO|FIXME|HACK|NOTE|REVIEW|OPTIMIZE|DO ZROBIENIA|POPRAW|UWAGA|POMYŚL)\b:?\s*(.*)/gi;

            let match;
            while ((match = regex.exec(text)) !== null) {
                const line = document.positionAt(match.index).line;
                todos.push({
                    text: match[0],
                    file: file.fsPath,
                    line: line,
                    tag: match[1],
                    urgency: ['FIXME', 'POPRAW'].includes(match[1]) ? 1 : 0
                });
            }
        }

        return todos.sort((a, b) => b.urgency - a.urgency);
    }
}