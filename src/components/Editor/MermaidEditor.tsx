import React from 'react';
import './MermaidEditor.css';

export const EXAMPLE_DIAGRAMS: Record<string, string> = {
  'Login Flow': `flowchart TD
    A([Start]) --> B[Enter Credentials]
    B --> C{Valid?}
    C -->|Yes| D[Load Dashboard]
    C -->|No| E[Show Error]
    E --> B
    D --> F([End])`,

  'Payment Process': `flowchart TD
    A([Start]) --> B[Select Items]
    B --> C[Checkout]
    C --> D{Has Account?}
    D -->|Yes| E[Login]
    D -->|No| F[Guest Checkout]
    E --> G{Payment OK?}
    F --> G
    G -->|Yes| H[Send Confirmation]
    G -->|No| I[Retry Payment]
    I --> G
    H --> J([End])`,

  'CI/CD Pipeline': `flowchart TD
    A([Push Code]) --> B[Run Tests]
    B --> C{Tests Pass?}
    C -->|Yes| D[Build Docker Image]
    C -->|No| E[Notify Developer]
    D --> F{Staging OK?}
    F -->|Yes| G[Deploy Production]
    F -->|No| H[Rollback]
    G --> I([Done])`,

  'API Request': `flowchart TD
    A([Início]) --> B[Receber Request]
    B --> C{Autenticado?}
    C -->|Sim| D[Processar Dados]
    C -->|Não| E[Retornar 401]
    D --> F{Dados Válidos?}
    F -->|Sim| G[Salvar no Cache]
    F -->|Não| H[Retornar 400]
    G --> I[Enviar Resposta 200]
    E --> J([Fim])
    H --> J
    I --> J`,
};

interface MermaidEditorProps {
  source: string;
  onChange: (value: string) => void;
  onRender: () => void;
  parseError: string | null;
}

export const MermaidEditor: React.FC<MermaidEditorProps> = ({
  source,
  onChange,
  onRender,
  parseError,
}) => {
  const handleExampleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (key && EXAMPLE_DIAGRAMS[key]) {
      onChange(EXAMPLE_DIAGRAMS[key]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRender();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = source.slice(0, start) + '  ' + source.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="mermaid-editor-panel">
      <div className="editor-header">
        <span className="editor-title">DIAGRAM SOURCE</span>
        <select className="example-select" onChange={handleExampleSelect} defaultValue="">
          <option value="" disabled>
            Load example…
          </option>
          {Object.keys(EXAMPLE_DIAGRAMS).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="mermaid-editor"
        value={source}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder={`flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| A`}
      />

      <div className="editor-footer">
        <button className="btn-control btn-control--primary" onClick={onRender}>
          ▸ Parse &amp; Render
        </button>
        <span className="shortcut-hint">⌘⏎</span>
      </div>

      {parseError && <div className="parse-error">{parseError}</div>}
    </div>
  );
};
