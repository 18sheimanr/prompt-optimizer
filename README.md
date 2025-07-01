# Prompt Optimizer Web App

This project is a web application designed to optimize prompts for Large Language Models (LLMs). It takes user-provided examples of inputs and desired outputs, along with an initial prompt. The application then iteratively refines the prompt using two LLM calls: one to generate an output based on the current prompt and an input example, and another (an "analyzer" LLM) to evaluate the deviation of the generated output from the desired output and suggest prompt modifications. This process continues until the outputs are acceptable across all provided examples.

The application also features an option to generate synthetic examples based on an initial set of five examples provided by the user.

## Project Structure

```
prompt-optimizer/
├── frontend/             # React app
│   ├── public/
│   └── src/
│       ├── components/
│       └── App.js
│       └── index.js
│   ├── package.json
│   └── ... (other React files)
├── backend/              # Flask app
│   ├── app.py
│   └── requirements.txt
└── README.md
```

## Features

-   **Prompt Optimization:** Iteratively refines a given prompt based on input/output examples.
-   **Synthetic Example Generation:** Generates additional training examples from a small initial set.
-   **User-Friendly Interface:** Allows users to easily input their data and view results.

## Tech Stack

-   **Frontend:** React
-   **Backend:** Python (Flask)
-   **LLM Interaction:** (To be determined - likely via an API like OpenAI's) 