from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import openai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Try to get the OpenAI API key from environment variables
try:
    openai.api_key = os.environ.get("OPENAI_API_KEY")
    if openai.api_key is None:
        raise ValueError("OPENAI_API_KEY environment variable not set. Make sure it's in your .env file or environment.")
except Exception as e:
    print(f"Error initializing OpenAI API key: {e}")
    # You might want to handle this more gracefully or ensure the app doesn't fully start
    # For now, we'll let it proceed but API calls will fail.

def call_llm(prompt, system_message=None, temperature=0.7, max_tokens=150):
    """Helper function to call the OpenAI API."""
    if not openai.api_key:
        return {"error": "OpenAI API key not configured."}
    try:
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        response = openai.chat.completions.create(
            model="gpt-4o", # You can change the model
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return {"error": f"OpenAI API call failed: {str(e)}"}

@app.route("/api/test-key", methods=["GET"])
def test_key():
    """Endpoint to test if the OpenAI API key is working."""
    test_prompt = "Hello!"
    response = call_llm(test_prompt, max_tokens=5)
    if isinstance(response, dict) and "error" in response:
        return jsonify({"success": False, "message": response["error"]}), 500
    return jsonify({"success": True, "message": "OpenAI API key is working.", "response": response})


@app.route("/api/optimize", methods=["POST"])
def optimize_prompt_route():
    data = request.get_json()
    initial_prompt = data.get("initialPrompt")
    examples = data.get("examples") # List of {input: "...", output: "..."}
    max_iterations = data.get("maxIterations", 3) # Max iterations per example

    if not initial_prompt or not examples:
        return jsonify({"error": "Missing initialPrompt or examples"}), 400
    if not openai.api_key:
        return jsonify({"error": "OpenAI API key not configured."}), 500

    current_prompt = initial_prompt
    optimization_history = [] # To track changes

    for i in range(max_iterations): # Overall optimization loop
        prompt_changed_in_iteration = False
        for example in examples:
            example_input = example.get("input")
            desired_output = example.get("output")

            if not example_input or not desired_output:
                optimization_history.append({
                    "iteration": i + 1,
                    "example_input": example_input,
                    "status": "Skipped",
                    "reason": "Missing input or output for example"
                })
                continue

            # Step 1: Generate output with current prompt and example input
            # Check for {{input}} placeholder in the prompt
            prompt_to_use_for_generation = ""
            if "{{input}}" in current_prompt:
                prompt_to_use_for_generation = current_prompt.replace("{{input}}", example_input)
            else:
                # Fallback to old behavior if no placeholder is found
                prompt_to_use_for_generation = f"{current_prompt}\n\nInput: {example_input}\nOutput:"

            generated_output_response = call_llm(prompt_to_use_for_generation, max_tokens=200)
            if isinstance(generated_output_response, dict) and "error" in generated_output_response:
                return jsonify({"error": f"LLM call failed during generation: {generated_output_response['error']}"}), 500
            
            generated_output = generated_output_response

            # Step 2: Analyzer LLM call
            analyzer_system_message = (
                "You are an expert AI prompt engineer with deep expertise in optimizing prompts for maximum effectiveness. "
                "Your task is to analyze and improve a prompt based on its performance against a specific example.\n\n"
                
                "## Analysis Framework:\n"
                "1. **Gap Analysis**: Compare the generated output vs desired output. Identify specific discrepancies in:\n"
                "   - Content accuracy and completeness\n"
                "   - Format, structure, and style\n"
                "   - Tone, voice, and register\n"
                "   - Length and detail level\n"
                "   - Missing or extra information\n\n"
                
                "2. **Root Cause**: Determine what aspect of the current prompt caused the deviation:\n"
                "   - Insufficient specificity or clarity\n"
                "   - Missing instructions about format/style\n"
                "   - Ambiguous language or conflicting directives\n"
                "   - Lack of examples or context\n"
                "   - Over-specification that limits flexibility\n\n"
                
                "3. **Optimization Strategy**: Apply prompt engineering best practices:\n"
                "   - Add specific instructions for identified gaps\n"
                "   - Include format specifications if needed\n"
                "   - Clarify ambiguous terms\n"
                "   - Add relevant context or constraints\n"
                "   - Use clear, actionable language\n"
                "   - Maintain generalizability for other examples\n\n"
                
                "## Decision Criteria:\n"
                "Respond with 'KEEP_CURRENT_PROMPT' only if:\n"
                "- Generated output matches desired output in all key aspects (content, format, style)\n"
                "- Minor differences are acceptable variations rather than errors\n"
                "- The prompt is already well-optimized for this type of task\n\n"
                
                "## Output Requirements:\n"
                "If changes are needed, provide ONLY the revised prompt text with these qualities:\n"
                "- Clear, specific, and unambiguous instructions\n"
                "- Maintains or improves generalizability\n"
                "- Addresses the identified root causes\n"
                "- Uses proper formatting and structure\n"
                "- Preserves any {{input}} placeholders if present\n\n"
                
                "Provide NO explanations, analysis, or commentary - only the prompt text or 'KEEP_CURRENT_PROMPT'."
            )
            analyzer_prompt = (
                f"Current Prompt:\n{current_prompt}\n\n"
                f"Input:\n{example_input}\n\n"
                f"Generated Output (with current prompt):\n{generated_output}\n\n"
                f"Desired Output:\n{desired_output}\n\n"
                f"Based on the deviation, suggest a revised prompt or respond with 'KEEP_CURRENT_PROMPT':"
            )
            
            suggestion_response = call_llm(analyzer_prompt, system_message=analyzer_system_message, max_tokens=300, temperature=0.5)
            if isinstance(suggestion_response, dict) and "error" in suggestion_response:
                return jsonify({"error": f"LLM call failed during analysis: {suggestion_response['error']}"}), 500

            suggested_prompt = suggestion_response

            optimization_history.append({
                "iteration": i + 1,
                "example_input": example_input,
                "current_prompt_used": current_prompt,
                "generated_output": generated_output,
                "desired_output": desired_output,
                "analyzer_suggestion": suggested_prompt
            })

            if suggested_prompt != "KEEP_CURRENT_PROMPT" and suggested_prompt != current_prompt:
                current_prompt = suggested_prompt
                prompt_changed_in_iteration = True
        
        if not prompt_changed_in_iteration and i > 0: # No changes in a full pass over examples
            optimization_history.append({"status": "Optimization converged.", "iteration": i+1})
            break 

    return jsonify({
        "optimizedPrompt": current_prompt,
        "initialPrompt": initial_prompt,
        "optimizationHistory": optimization_history
    })

@app.route("/api/generate-examples", methods=["POST"])
def generate_examples_route():
    data = request.get_json()
    examples = data.get("examples") # List of {input: "...", output: "..."}
    num_to_generate = data.get("numToGenerate", 5)

    if not examples:
        return jsonify({"error": "Missing examples to base generation on"}), 400
    if not openai.api_key:
        return jsonify({"error": "OpenAI API key not configured."}), 500

    # Create a string representation of the provided examples
    example_str = ""
    for ex in examples:
        example_str += f"Input: {ex.get('input', '')}\nOutput: {ex.get('output', '')}\n\n"

    generation_prompt = (
        f"Here are some examples of inputs and outputs:\n\n{example_str}"
        f"Based on these examples, generate {num_to_generate} new, distinct input-output pairs that follow the same pattern. "
        "Format each new pair as:\nInput: [new input]\nOutput: [new output]\n\n"
        "Ensure the generated examples are different from the provided ones and from each other."
    )
    
    system_message_generation = "You are an AI assistant that generates synthetic examples based on a provided set. Ensure the examples are diverse and follow the implicit pattern."
    
    generated_response = call_llm(generation_prompt, system_message=system_message_generation, temperature=0.8, max_tokens=1000) # Allow more tokens for multiple examples
    
    if isinstance(generated_response, dict) and "error" in generated_response:
        return jsonify({"error": f"LLM call failed during example generation: {generated_response['error']}"}), 500

    # Parse the generated string into a list of {input, output}
    synthetic_examples = []
    current_input = None
    for line in generated_response.split('\n'):
        line = line.strip()
        if line.startswith("Input:"):
            current_input = line.replace("Input:", "").strip()
        elif line.startswith("Output:") and current_input is not None:
            output = line.replace("Output:", "").strip()
            synthetic_examples.append({"input": current_input, "output": output})
            current_input = None # Reset for the next pair
        elif not line: # Reset if there's an empty line, in case of formatting issues
            current_input = None


    return jsonify({
        "generatedExamples": synthetic_examples,
        "promptUsed": generation_prompt # For debugging or info
    })

@app.route("/api/test-prompt", methods=["POST"])
def test_prompt_route():
    data = request.get_json()
    prompt_to_test = data.get("initialPrompt")
    examples = data.get("examples") # List of {input: "...", output: "..."}

    if not prompt_to_test or not examples:
        return jsonify({"error": "Missing initialPrompt or examples"}), 400
    if not openai.api_key:
        return jsonify({"error": "OpenAI API key not configured."}), 500

    test_results = []

    for example in examples:
        example_input = example.get("input")
        desired_output = example.get("output") # We include desired_output for comparison on the frontend

        if example_input is None: # Allow empty string for input, but not None
            test_results.append({
                "example_input": "N/A - Missing",
                "desired_output": desired_output,
                "generated_output": "N/A - Input missing",
                "error": "Input missing for this example."
            })
            continue
        
        if "{{input}}" in prompt_to_test:
            prompt_to_use_for_generation = prompt_to_test.replace("{{input}}", example_input)
        else:
            # Ensure example_input is a string, even if it's empty, for the f-string.
            safe_example_input = example_input if example_input is not None else ""
            prompt_to_use_for_generation = f"{prompt_to_test}\n\nInput: {safe_example_input}\nOutput:"

        generated_output_response = call_llm(prompt_to_use_for_generation, max_tokens=200)
        
        current_result = {
            "example_input": example_input,
            "desired_output": desired_output,
        }

        if isinstance(generated_output_response, dict) and "error" in generated_output_response:
            current_result["generated_output"] = "Error during generation."
            current_result["error_detail"] = generated_output_response["error"]
        else:
            current_result["generated_output"] = generated_output_response
        
        test_results.append(current_result)

    return jsonify({"testResults": test_results})


if __name__ == "__main__":
    app.run(debug=True, port=5001) # Changed port to avoid conflict with React dev server 