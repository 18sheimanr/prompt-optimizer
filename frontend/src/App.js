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

  // New state for saved prompts management
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [promptName, setPromptName] = useState('');

  // Load saved prompts from localStorage on component mount
  useEffect(() => {
    const loadSavedPrompts = () => {
      try {
        const saved = localStorage.getItem('promptOptimizer_savedPrompts');
        if (saved) {
          const parsedSaved = JSON.parse(saved);
          setSavedPrompts(parsedSaved);
        }
      } catch (error) {
        console.error('Error loading saved prompts:', error);
      }
    };
    loadSavedPrompts();
  }, []);

  // Helper function to save to localStorage
  const saveToLocalStorage = (prompts) => {
    try {
      localStorage.setItem('promptOptimizer_savedPrompts', JSON.stringify(prompts));
    } catch (error) {
      console.error('Error saving prompts to localStorage:', error);
    }
  };

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

  // Helper function to generate unique ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  };

  // Helper function to get current prompt title
  const getCurrentPromptTitle = () => {
    if (currentPromptId) {
      const current = savedPrompts.find(p => p.id === currentPromptId);
      return current ? current.name : 'Untitled Prompt';
    }
    return promptName || 'New Prompt';
  };

  // Load a saved prompt
  const loadPrompt = (promptData) => {
    setInitialPrompt(promptData.initialPrompt);
    setExamples(promptData.examples.length > 0 ? promptData.examples : [{ input: '', output: '' }]);
    setCurrentPromptId(promptData.id);
    setPromptName(promptData.name);
    setOptimizationHistory([]);
    setGeneratedExamples([]);
    setTestRunResults([]);
    setSidebarOpen(false);
    setStatusMessage(`Loaded prompt: "${promptData.name}"`);
  };

  // Save current prompt
  const saveCurrentPrompt = () => {
    const activeExamples = examples.filter(ex => ex.input.trim() || ex.output.trim());
    if (!initialPrompt.trim() && activeExamples.length === 0) {
      setStatusMessage('Nothing to save. Please add a prompt or examples.');
      return;
    }

    const name = promptName.trim() || `Prompt ${new Date().toLocaleString()}`;
    
    // Check if a prompt with this name already exists (and it's not the current prompt)
    const existingPromptWithName = savedPrompts.find(p => p.name === name && p.id !== currentPromptId);
    
    let promptData;
    let updatedPrompts;
    
    if (existingPromptWithName) {
      // Overwrite existing prompt with the same name
      promptData = {
        id: existingPromptWithName.id,
        name,
        initialPrompt,
        examples,
        savedAt: existingPromptWithName.savedAt, // Keep original save date
        lastModified: new Date().toISOString()
      };
      updatedPrompts = savedPrompts.map(p => p.id === existingPromptWithName.id ? promptData : p);
      setCurrentPromptId(existingPromptWithName.id);
      setStatusMessage(`Prompt "${name}" overwritten successfully.`);
    } else if (currentPromptId) {
      // Update existing prompt (current prompt)
      promptData = {
        id: currentPromptId,
        name,
        initialPrompt,
        examples,
        savedAt: savedPrompts.find(p => p.id === currentPromptId)?.savedAt || new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      updatedPrompts = savedPrompts.map(p => p.id === currentPromptId ? promptData : p);
      setStatusMessage(`Prompt "${name}" updated successfully.`);
    } else {
      // Save as new prompt
      promptData = {
        id: generateId(),
        name,
        initialPrompt,
        examples,
        savedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      updatedPrompts = [...savedPrompts, promptData];
      setCurrentPromptId(promptData.id);
      setStatusMessage(`Prompt "${name}" saved successfully.`);
    }
    
    setSavedPrompts(updatedPrompts);
    
    // Save to localStorage
    saveToLocalStorage(updatedPrompts);
  };

  // Create new prompt (save current and clear)
  const createNewPrompt = () => {
    // Save current if there's content
    const activeExamples = examples.filter(ex => ex.input.trim() || ex.output.trim());
    if (initialPrompt.trim() || activeExamples.length > 0) {
      const name = promptName.trim() || getCurrentPromptTitle();
      const promptData = {
        id: currentPromptId || generateId(),
        name,
        initialPrompt,
        examples,
        savedAt: currentPromptId ? savedPrompts.find(p => p.id === currentPromptId)?.savedAt : new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      let updatedPrompts;
      if (currentPromptId) {
        updatedPrompts = savedPrompts.map(p => p.id === currentPromptId ? promptData : p);
      } else {
        updatedPrompts = [...savedPrompts, promptData];
      }
      setSavedPrompts(updatedPrompts);
      
      // Save to localStorage
      saveToLocalStorage(updatedPrompts);
    }

    // Clear current state
    setInitialPrompt('');
    setExamples([{ input: '', output: '' }]);
    setCurrentPromptId(null);
    setPromptName('');
    setOptimizationHistory([]);
    setGeneratedExamples([]);
    setTestRunResults([]);
    setSidebarOpen(false);
    setStatusMessage('Started new prompt. Previous work has been saved.');
  };

  // Delete a saved prompt
  const deleteSavedPrompt = (promptId) => {
    const updatedPrompts = savedPrompts.filter(p => p.id !== promptId);
    setSavedPrompts(updatedPrompts);
    
    // Save to localStorage
    saveToLocalStorage(updatedPrompts);
    
    if (currentPromptId === promptId) {
      setCurrentPromptId(null);
    }
    setStatusMessage('Prompt deleted successfully.');
  };

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
        <div className="header-content">
          <div className="header-left">
            <h1>Prompt Optimizer</h1>
            <div className="current-prompt-info">
              <span className="current-prompt-title">{getCurrentPromptTitle()}</span>
              {currentPromptId && <span className="saved-indicator">●</span>}
            </div>
          </div>
          <div className="header-right">
            <div className="prompt-management">
              <input
                type="text"
                placeholder="Prompt name (optional)"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                disabled={isLoading}
                className="prompt-name-input"
              />
              <button 
                onClick={saveCurrentPrompt} 
                disabled={isLoading}
                className="save-button"
              >
                Save
              </button>
              <button 
                onClick={createNewPrompt}
                disabled={isLoading}
                className="new-prompt-button"
              >
                New Prompt
              </button>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                disabled={isLoading}
                className="sidebar-toggle"
              >
                Saved Prompts ({savedPrompts.length})
              </button>
            </div>
          </div>
        </div>
        <div className="api-status">
          API Key Status: 
          {apiKeyStatus.checked ? 
            (apiKeyStatus.working ? <span style={{color: 'lightgreen'}}>✔ Working</span> : <span style={{color: 'salmon'}}>✘ Error</span>) : 
            <span>Checking...</span>}
          {apiKeyStatus.checked && apiKeyStatus.message && <small style={{display: 'block', opacity: 0.8}}>({apiKeyStatus.message})</small>}
        </div>
      </header>

      {/* Sidebar for saved prompts */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h3>Saved Prompts</h3>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="close-sidebar"
              >
                ×
              </button>
            </div>
            <div className="sidebar-content">
              {savedPrompts.length === 0 ? (
                <p className="no-saved-prompts">No saved prompts yet.</p>
              ) : (
                <ul className="saved-prompts-list">
                  {savedPrompts.map((prompt) => (
                    <li 
                      key={prompt.id} 
                      className={`saved-prompt-item ${currentPromptId === prompt.id ? 'active' : ''}`}
                    >
                      <div className="prompt-info">
                        <div className="prompt-name">{prompt.name}</div>
                        <div className="prompt-meta">
                          <small>
                            {prompt.examples.filter(ex => ex.input.trim() || ex.output.trim()).length} examples
                            {' • '}
                            {new Date(prompt.lastModified).toLocaleDateString()}
                          </small>
                        </div>
                        <div className="prompt-preview">
                          {prompt.initialPrompt.substring(0, 100)}
                          {prompt.initialPrompt.length > 100 ? '...' : ''}
                        </div>
                      </div>
                      <div className="prompt-actions">
                        <button 
                          onClick={() => loadPrompt(prompt)}
                          disabled={isLoading}
                          className="load-button"
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => deleteSavedPrompt(prompt.id)}
                          disabled={isLoading}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <main>
        {statusMessage && <div className={`status-message ${isLoading && (statusMessage.includes('Optimizing') || statusMessage.includes('Generating') || statusMessage.includes('Testing')) ? 'loading' : ''}`}>{statusMessage}</div>}
        
        <div className="main-content">
          <div className="left-column">
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
              <h2>Input/Output Examples</h2>
              <p className="section-description">Add examples to guide prompt optimization and testing</p>
              <div className="examples-container">
                <div className={`examples-table ${testRunResults.length > 0 ? 'with-results' : ''}`}>
                  <div className="examples-header">
                    <div className="header-input">Input</div>
                    <div className="header-output">Expected Output</div>
                    {testRunResults.length > 0 && (
                      <div className="header-test-result">Test Result</div>
                    )}
                  </div>
                  {examples.map((example, index) => {
                    const testResult = testRunResults[index];
                    const hasTestResult = testResult && testRunResults.length > 0;
                    const isMatch = hasTestResult && 
                      testResult.desired_output?.trim() === testResult.generated_output?.trim() && 
                      !testResult.error_detail;
                    
                    return (
                      <div key={index} className="example-row">
                        <div className="example-input">
                          <textarea
                            value={example.input}
                            onChange={(e) => handleExampleChange(index, 'input', e.target.value)}
                            placeholder={`Input Example ${index + 1}`}
                            rows={3}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="example-output">
                          <textarea
                            value={example.output}
                            onChange={(e) => handleExampleChange(index, 'output', e.target.value)}
                            placeholder={`Output Example ${index + 1} (desired output)`}
                            rows={3}
                            disabled={isLoading}
                          />
                        </div>
                        {testRunResults.length > 0 && (
                          <div className={`example-test-result ${isMatch ? 'match' : 'no-match'} ${hasTestResult ? 'has-result' : ''}`}>
                            {hasTestResult ? (
                              <div className="test-result-content">
                                <div className={`result-status ${isMatch ? 'success' : 'error'}`}>
                                  {isMatch ? '✓ Match' : '✗ No Match'}
                                </div>
                                <div className="generated-output">
                                  <label>Generated:</label>
                                  <div className="output-text">
                                    {testResult.error_detail ? (
                                      <span className="error-text">{testResult.error_detail}</span>
                                    ) : (
                                      testResult.generated_output
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="no-result">
                                <span>No test result</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleAddExample} disabled={isLoading} className="secondary-button">Add Example</button>
            </section>

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
          </div>

          <div className="right-column">
            <div className="control-panel">
              <section className="config-section">
                <h3>Configuration</h3>
                <div className="config-item">
                  <label htmlFor="maxIterations">Max Optimization Iterations</label>
                  <input 
                    type="number" 
                    id="maxIterations" 
                    value={maxIterations} 
                    onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))} 
                    min="1"
                    disabled={isLoading}
                  />
                </div>
                <div className="config-item">
                  <label htmlFor="numToGenerate">Synthetic Examples to Generate</label>
                  <input 
                    type="number" 
                    id="numToGenerate" 
                    value={numToGenerate} 
                    onChange={(e) => setNumToGenerate(parseInt(e.target.value, 10))} 
                    min="1"
                    disabled={isLoading}
                  />
                </div>
              </section>

              <section className="actions-section">
                <h3>Actions</h3>
                <button 
                  onClick={handleTestCurrentPrompt} 
                  disabled={isLoading || !initialPrompt.trim() || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
                  className="test-button primary-button"
                >
                  {isLoading && statusMessage.includes('Testing') ? 'Testing...' : 'Test Current Prompt'}
                </button>
                <button 
                  onClick={handleOptimizePrompt} 
                  disabled={isLoading || !initialPrompt.trim() || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
                  className="optimize-button primary-button"
                >
                  {isLoading && statusMessage.includes('Optimizing') ? 'Optimizing...' : 'Optimize Prompt'}
                </button>
              </section>

              <section className="synthetic-section">
                <h3>Synthetic Examples</h3>
                <p className="section-description">Generate additional examples based on your existing ones</p>
                <button 
                  onClick={handleGenerateExamples} 
                  disabled={isLoading || examples.filter(ex => ex.input.trim() || ex.output.trim()).length === 0 || !apiKeyStatus.working}
                  className="generate-button secondary-button"
                >
                  {isLoading && statusMessage.includes('Generating') ? 'Generating...' : generateButtonText}
                </button>
                
                {generatedExamples.length > 0 && (
                  <div className="generated-examples">
                    <h4>Review & Approve</h4>
                    <ul className="generated-examples-list">
                      {generatedExamples.map((ex, i) => (
                        <li key={`synth-${i}`} className="generated-example-item">
                          <div className="example-content">
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
