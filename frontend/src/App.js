import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:5001/api'; // Backend API URL

function App() {
  const [initialPrompt, setInitialPrompt] = useState('');
  const [examples, setExamples] = useState([{ input: '', output: '' }]);
  const [optimizationHistory, setOptimizationHistory] = useState([]);
  const [generatedExamples, setGeneratedExamples] = useState([]);
  const [apiKeyStatus, setApiKeyStatus] = useState({ checked: false, working: false, message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [maxIterations, setMaxIterations] = useState(3);
  const [numToGenerate, setNumToGenerate] = useState(5);
  const [testRunResults, setTestRunResults] = useState([]);

  // Check API Key status on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/test-key`);
        const data = await response.json();
        if (response.ok) {
          setApiKeyStatus({ checked: true, working: true, message: data.message });
        } else {
          setApiKeyStatus({ checked: true, working: false, message: data.message || 'Failed to connect to backend or API key issue.' });
        }
      } catch (error) {
        setApiKeyStatus({ checked: true, working: false, message: `Error checking API key: ${error.message}` });
      }
    };
    checkApiKey();
  }, []);

  const handleAddExample = () => {
    setExamples([...examples, { input: '', output: '' }]);
  };

  const handleExampleChange = (index, field, value) => {
    const newExamples = [...examples];
    newExamples[index][field] = value;
    setExamples(newExamples);
  };

  const handleOptimizePrompt = async () => {
    if (!apiKeyStatus.working) {
      setStatusMessage('OpenAI API key is not working. Please check backend configuration.');
      return;
    }
    setIsLoading(true);
    setStatusMessage('Optimizing prompt...');
    setOptimizationHistory([]);
    setTestRunResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPrompt, examples, maxIterations }),
      });
      const data = await response.json();
      if (response.ok) {
        setInitialPrompt(data.optimizedPrompt);
        setOptimizationHistory(data.optimizationHistory || []);
        setStatusMessage('Prompt optimization finished. The Initial Prompt has been updated with the optimized version.');
      } else {
        setStatusMessage(`Error: ${data.error || 'Optimization failed'}`);
      }
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleGenerateExamples = async () => {
    if (!apiKeyStatus.working) {
      setStatusMessage('OpenAI API key is not working. Please check backend configuration.');
      return;
    }
    const activeExamples = examples.filter(ex => ex.input.trim() || ex.output.trim());
    if (activeExamples.length === 0) {
        setStatusMessage('Please provide at least one complete example to base generation on.');
        return;
    }
    setIsLoading(true);
    setStatusMessage(generatedExamples.length > 0 ? 'Regenerating examples...' : 'Generating examples...');
    setGeneratedExamples([]);
    setTestRunResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples: activeExamples, numToGenerate }),
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedExamples(data.generatedExamples || []);
        setStatusMessage(data.generatedExamples && data.generatedExamples.length > 0 ? 'Synthetic examples generated.' : 'No synthetic examples were generated.');
      } else {
        setStatusMessage(`Error: ${data.error || 'Example generation failed'}`);
        setGeneratedExamples([]);
      }
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`);
      setGeneratedExamples([]);
    }
    setIsLoading(false);
  };

  const handleApproveSyntheticExample = (indexToApprove) => {
    const exampleToApprove = generatedExamples[indexToApprove];
    setExamples([...examples, exampleToApprove]);
    setGeneratedExamples(generatedExamples.filter((_, index) => index !== indexToApprove));
    setStatusMessage('Synthetic example approved and added to main examples.');
  };

  const handleTestCurrentPrompt = async () => {
    if (!apiKeyStatus.working) {
      setStatusMessage('OpenAI API key is not working. Please check backend configuration.');
      return;
    }
    const activeExamples = examples.filter(ex => ex.input.trim() || ex.output.trim());
    if (!initialPrompt.trim() || activeExamples.length === 0) {
      setStatusMessage('Please provide an Initial Prompt and at least one example to test.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Testing current prompt against examples...');
    setTestRunResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/test-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPrompt, examples: activeExamples }),
      });
      const data = await response.json();
      if (response.ok) {
        setTestRunResults(data.testResults || []);
        setStatusMessage('Prompt testing finished.');
      } else {
        setStatusMessage(`Error: ${data.error || 'Prompt testing failed'}`);
      }
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };
  
  const generateButtonText = generatedExamples.length > 0 
    ? `Regenerate ${numToGenerate} Synthetic Examples` 
    : `Generate ${numToGenerate} Synthetic Examples`;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Prompt Optimizer</h1>
        <div className="api-status">
          API Key Status: 
          {apiKeyStatus.checked ? 
            (apiKeyStatus.working ? <span style={{color: 'lightgreen'}}>✔ Working</span> : <span style={{color: 'salmon'}}>✘ Error</span>) : 
            <span>Checking...</span>}
          {apiKeyStatus.checked && apiKeyStatus.message && <small style={{display: 'block', opacity: 0.8}}>({apiKeyStatus.message})</small>}
        </div>
      </header>
      <main>
        {statusMessage && <div className={`status-message ${isLoading && (statusMessage.includes('Optimizing') || statusMessage.includes('Generating') || statusMessage.includes('Testing')) ? 'loading' : ''}`}>{statusMessage}</div>}
        
        <section>
          <h2>Initial Prompt</h2>
          <textarea
            value={initialPrompt}
            onChange={(e) => setInitialPrompt(e.target.value)}
            placeholder="Enter your initial prompt here. Use {{input}} to specify where example input should be inserted."
            rows={5}
            disabled={isLoading}
          />
        </section>

        <section>
          <h2>Input/Output Examples (for Optimization & Testing)</h2>
          {examples.map((example, index) => (
            <div key={index} className="example-pair">
              <textarea
                value={example.input}
                onChange={(e) => handleExampleChange(index, 'input', e.target.value)}
                placeholder={`Input Example ${index + 1}`}
                rows={3}
                disabled={isLoading}
              />
              <textarea
                value={example.output}
                onChange={(e) => handleExampleChange(index, 'output', e.target.value)}
                placeholder={`Output Example ${index + 1} (desired output)`}
                rows={3}
                disabled={isLoading}
              />
            </div>
          ))}
          <button onClick={handleAddExample} disabled={isLoading}>Add Example</button>
        </section>

        <section style={{ fontSize: '0.9em', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', margin: '10px 0' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1em', color: '#666' }}>Configuration</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label htmlFor="maxIterations" style={{ marginRight: '5px', fontSize: '0.9em' }}>Max Optimization Iterations: </label>
              <input 
                type="number" 
                id="maxIterations" 
                value={maxIterations} 
                onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))} 
                min="1"
                disabled={isLoading}
                style={{ width: '60px' }}
              />
            </div>
            <div>
              <label htmlFor="numToGenerate" style={{ marginRight: '5px', fontSize: '0.9em' }}>Synthetic Examples to Generate: </label>
              <input 
                type="number" 
                id="numToGenerate" 
                value={numToGenerate} 
                onChange={(e) => setNumToGenerate(parseInt(e.target.value, 10))} 
                min="1"
                disabled={isLoading}
                style={{ width: '60px' }}
              />
            </div>
          </div>
        </section>

        <section className="actions-section">
          <button 
            onClick={handleTestCurrentPrompt} 
            disabled={isLoading || !initialPrompt.trim() || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
            className="test-button"
          >
            {isLoading && statusMessage.includes('Testing') ? 'Testing...' : 'Test Current Prompt'}
          </button>
          <button 
            onClick={handleOptimizePrompt} 
            disabled={isLoading || !initialPrompt.trim() || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
          >
            {isLoading && statusMessage.includes('Optimizing') ? 'Optimizing...' : 'Optimize Prompt'}
          </button>
        </section>
        
        {testRunResults.length > 0 && (
          <section className="results-display-section">
            <details open>
              <summary style={{ cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold', marginBottom: '10px' }}>
                Prompt Test Results ({testRunResults.length} examples)
              </summary>
              <ul className="test-results-list">
                {testRunResults.map((result, index) => {
                  const isMatch = result.desired_output?.trim() === result.generated_output?.trim() && !result.error_detail;
                  const backgroundColor = isMatch ? '#f0f8f0' : '#fff0f0';
                  
                  return (
                    <li key={`test-res-${index}`} className="test-result-item" style={{ backgroundColor, padding: '15px', borderRadius: '5px', marginBottom: '10px' }}>
                      <p><strong>Input Example:</strong> <pre>{result.example_input}</pre></p>
                      <p><strong>Desired Output:</strong> <pre>{result.desired_output}</pre></p>
                      <p><strong>Generated Output (with current prompt):</strong> <pre className={result.error_detail ? 'error-text' : ''}>{result.generated_output}</pre></p>
                      {result.error_detail && <p className="error-text"><strong>Error:</strong> {result.error_detail}</p>}
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        )}

        {optimizationHistory.length > 0 && (
            <div className="results-section">
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold', marginBottom: '10px' }}>
                  Optimization History ({optimizationHistory.length} iterations)
                </summary>
                <ul className="history-list">
                  {optimizationHistory.map((item, index) => (
                    <li key={index} className="history-item">
                      <strong>Iteration {item.iteration || 'N/A'}:</strong> {item.status || `Processed input: ${item.example_input || 'N/A'}`}
                      {item.current_prompt_used && <details>
                          <summary>Details</summary>
                          <p><strong>Prompt Used:</strong> <pre>{item.current_prompt_used}</pre></p>
                          <p><strong>Generated Output:</strong> <pre>{item.generated_output}</pre></p>
                          <p><strong>Desired Output:</strong> <pre>{item.desired_output}</pre></p>
                          <p><strong>Analyzer Suggestion:</strong> <pre>{item.analyzer_suggestion}</pre></p>
                      </details>}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

        <section>
          <h2>Synthetic Example Generation</h2>
          <button 
            onClick={handleGenerateExamples} 
            disabled={isLoading || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
          >
            {isLoading && statusMessage.includes('Generating') ? 'Generating...' : generateButtonText}
          </button>
          {generatedExamples.length > 0 && (
            <div className="results-section">
              <h3>Generated Examples (Review and Approve)</h3>
              <ul className="generated-examples-list">
                {generatedExamples.map((ex, i) => (
                  <li key={`synth-${i}`} className="generated-example-item">
                    <div>
                      <p><strong>Input:</strong> <pre>{ex.input}</pre></p>
                      <p><strong>Output:</strong> <pre>{ex.output}</pre></p>
                    </div>
                    <button onClick={() => handleApproveSyntheticExample(i)} disabled={isLoading} className="approve-button">
                      Approve & Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
