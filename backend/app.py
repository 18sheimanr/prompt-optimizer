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
        # Step 1: Generate outputs for ALL examples with current prompt
        batch_results = []
        
        for example in examples:
            example_input = example.get("input")
            desired_output = example.get("output")

            if not example_input or not desired_output:
                batch_results.append({
                    "input": example_input,
                    "desired_output": desired_output,
                    "generated_output": "SKIPPED - Missing input or output",
                    "status": "skipped"
                })
                continue

            # Generate output with current prompt and example input
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
            
            batch_results.append({
                "input": example_input,
                "desired_output": desired_output,
                "generated_output": generated_output_response,
                "status": "processed"
            })

        # Step 2: Single Batch Analyzer LLM call for ALL examples
        analyzer_system_message = (
            "You are an expert AI prompt engineer with deep expertise in optimizing prompts for maximum effectiveness. "
            "Your task is to analyze and improve a prompt based on its performance against multiple examples simultaneously.\n\n"
            
            "## Critical Analysis Framework:\n"
            "1. **Precise Format Analysis**: Examine generated vs desired outputs CHARACTER BY CHARACTER for:\n"
            "   - EXACT capitalization (uppercase/lowercase mismatches)\n"
            "   - Quotation marks (missing, extra, or wrong type: \", ', `, etc.)\n"
            "   - Punctuation (periods, commas, colons, semicolons, etc.)\n"
            "   - Spacing (extra spaces, missing spaces, line breaks)\n"
            "   - Special characters and symbols\n"
            "   - Number formatting (1 vs 1.0 vs one)\n"
            "   - Date/time formats\n\n"
            
            "2. **Content & Structure Analysis**: Compare outputs for:\n"
            "   - Missing or extra words/phrases\n"
            "   - Word order and sentence structure\n"
            "   - Completeness of information\n"
            "   - Tone and style consistency\n"
            "   - Length and verbosity level\n\n"
            
            "3. **Pattern Recognition**: Identify systematic issues across ALL examples:\n"
            "   - Consistent formatting deviations (e.g., always adding quotes when shouldn't)\n"
            "   - Repeated content errors (e.g., always capitalizing certain words)\n"
            "   - Style inconsistencies (formal vs informal language)\n"
            "   - Structural problems (missing sections, wrong order)\n\n"
            
            "4. **Root Cause Analysis**: Determine what specific prompt deficiencies cause these issues:\n"
            "   - Missing explicit format instructions (e.g., 'do not use quotes', 'use lowercase')\n"
            "   - Ambiguous wording that allows multiple interpretations\n"
            "   - Lack of specific examples showing desired format\n"
            "   - Missing constraints or rules\n"
            "   - Conflicting instructions\n\n"
            
            "5. **Precision Optimization**: Create prompt improvements that:\n"
            "   - Add SPECIFIC format rules (e.g., 'Response must be lowercase', 'Never use quotation marks')\n"
            "   - Include explicit examples of correct formatting\n"
            "   - Use unambiguous, precise language\n"
            "   - Add format validation instructions\n"
            "   - Specify exact punctuation and capitalization rules\n"
            "   - Pay special attention to formatting issues (capitalization, quotes, spacing, punctuation)\n\n"
            
            "## Decision Criteria (STRICT):\n"
            "Respond with 'KEEP_CURRENT_PROMPT' ONLY if:\n"
            "- Generated outputs match desired outputs EXACTLY in format AND content\n"
            "- NO formatting discrepancies exist (capitalization, punctuation, quotes, spacing)\n"
            "- ALL examples pass character-by-character comparison\n"
            "- The prompt already contains sufficient format specifications\n\n"
            
            "## Output Requirements:\n"
            "If ANY formatting or content issues exist, provide ONLY the revised prompt that:\n"
            "- Addresses EVERY identified formatting issue with specific instructions\n"
            "- Includes explicit format rules and constraints\n"
            "- Uses precise, unambiguous language\n"
            "- Preserves {{input}} placeholders if present\n"
            "- Contains concrete examples if beneficial\n\n"
            
            "IMPORTANT: Focus heavily on EXACT FORMAT MATCHING. Even small differences in quotes, capitalization, or punctuation require prompt improvements.\n\n"
            "Provide NO explanations, analysis, or commentary - only the revised prompt text or 'KEEP_CURRENT_PROMPT'."
        )

        # Build the batch analysis prompt
        examples_analysis = ""
        for idx, result in enumerate(batch_results):
            if result["status"] == "skipped":
                continue
                
            examples_analysis += f"=== Example {idx + 1} Analysis ===\n"
            examples_analysis += f"Input: {result['input']}\n"
            examples_analysis += f"Generated Output: '{result['generated_output']}'\n"
            examples_analysis += f"Desired Output:   '{result['desired_output']}'\n"
            
            # Add character-by-character comparison hints
            generated = str(result['generated_output']).strip()
            desired = str(result['desired_output']).strip()
            
            if generated != desired:
                examples_analysis += f"MISMATCH DETECTED:\n"
                examples_analysis += f"- Generated length: {len(generated)} characters\n"
                examples_analysis += f"- Desired length:   {len(desired)} characters\n"
                
                # Check for common formatting issues
                if generated.lower() == desired.lower():
                    examples_analysis += f"- CAPITALIZATION ISSUE: Same content, different case\n"
                if generated.replace('"', '').replace("'", '') == desired.replace('"', '').replace("'", ''):
                    examples_analysis += f"- QUOTATION ISSUE: Same content, different quote usage\n"
                if generated.replace(' ', '') == desired.replace(' ', ''):
                    examples_analysis += f"- SPACING ISSUE: Same content, different spacing\n"
                    
            examples_analysis += f"\n"

        analyzer_prompt = (
            f"Current Prompt:\n{current_prompt}\n\n"
            f"Performance Analysis:\n{examples_analysis}"
            f"TASK: Analyze the mismatches above and suggest a revised prompt that will generate EXACTLY the desired outputs. "
            f"Pay special attention to formatting issues (capitalization, quotes, spacing, punctuation). "
            f"If ALL examples match perfectly, respond with 'KEEP_CURRENT_PROMPT'."
        )
        
        suggestion_response = call_llm(analyzer_prompt, system_message=analyzer_system_message, max_tokens=500, temperature=0.3)
        if isinstance(suggestion_response, dict) and "error" in suggestion_response:
            return jsonify({"error": f"LLM call failed during batch analysis: {suggestion_response['error']}"}), 500

        suggested_prompt = suggestion_response.strip()

        # Record this iteration in history
        iteration_info = {
            "iteration": i + 1,
            "current_prompt_used": current_prompt,
            "analyzer_suggestion": suggested_prompt,
            "prompt_changed": suggested_prompt != "KEEP_CURRENT_PROMPT" and suggested_prompt != current_prompt,
            "batch_performance": {
                "total_examples": len([r for r in batch_results if r["status"] == "processed"]),
                "skipped_examples": len([r for r in batch_results if r["status"] == "skipped"]),
                "examples_details": batch_results
            }
        }
        
        # Add iteration summary
        if suggested_prompt == "KEEP_CURRENT_PROMPT":
            iteration_info["summary"] = "No changes needed - prompt is performing well"
            iteration_info["status"] = "converged"
        elif suggested_prompt == current_prompt:
            iteration_info["summary"] = "Analyzer returned same prompt - no improvements found"
            iteration_info["status"] = "converged"
        else:
            iteration_info["summary"] = f"Prompt updated to address issues across {iteration_info['batch_performance']['total_examples']} examples"
            iteration_info["status"] = "updated"
        
        optimization_history.append(iteration_info)

        # Update prompt if suggestion is different
        if suggested_prompt != "KEEP_CURRENT_PROMPT" and suggested_prompt != current_prompt:
            current_prompt = suggested_prompt
        else:
            # No changes suggested - optimization has converged
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