# Prompt Optimizer Web App

This project is a web application designed to optimize prompts for Large Language Models (LLMs). It takes user-provided examples of inputs and desired outputs, along with an initial prompt. The application then iteratively refines the prompt using two LLM calls: one to generate an output based on the current prompt and an input example, and another (an "analyzer" LLM) to evaluate the deviation of the generated output from the desired output and suggest prompt modifications. This process continues until the outputs are acceptable across all provided examples.
The application also features an option to generate synthetic examples based on an initial set of five examples provided by the user.

<img width="1458" alt="Screenshot 2025-07-01 at 12 51 59 AM" src="https://github.com/user-attachments/assets/dc1ee5f7-2c04-4503-ae80-fab6941a53d5" />
<img width="1455" alt="Screenshot 2025-07-01 at 12 52 31 AM" src="https://github.com/user-attachments/assets/57886b42-6830-4454-800f-fa2821b10049" />

## 🚀 Quick Start

**One-command startup:**
```bash
./start.sh
```

This script will:
- Check prerequisites (Node.js, Python 3, npm, pip3)
- Set up Python virtual environment and install backend dependencies
- Install frontend dependencies
- Create a `.env` template file (you'll need to add your OpenAI API key)
- Start both frontend and backend servers
- Open the application in your browser

**Prerequisites:**
- Node.js (v14 or higher)
- Python 3.7+
- npm
- pip3

## 🔧 Manual Setup

If you prefer to set up manually:

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```
OPENAI_API_KEY=your_openai_api_key_here
FLASK_ENV=development
FLASK_DEBUG=True
```

Start the backend:
```bash
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

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
│   ├── requirements.txt
│   └── .env (you need to create this)
├── start.sh              # Quick start script
└── README.md
```

## Features

-   **Prompt Optimization:** Iteratively refines a given prompt based on input/output examples using batch processing for efficiency
-   **Synthetic Example Generation:** Generates additional training examples from a small initial set
-   **Prompt Testing:** Test your prompts against multiple examples to see how they perform
-   **User-Friendly Interface:** Allows users to easily input their data and view results

## Tech Stack

-   **Frontend:** React
-   **Backend:** Python (Flask)
-   **LLM Integration:** OpenAI GPT-4

## 🔑 API Key Setup

You need an OpenAI API key to use this application:

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add it to `backend/.env` file:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

## 🌐 Usage

1. Open http://localhost:3000 in your browser
2. Enter your initial prompt
3. Add input/output examples
4. Click "Optimize Prompt" to improve your prompt
5. Test the optimized prompt with your examples
6. Generate additional synthetic examples if needed

## 🛑 Stopping the Application

When using the quick start script, press `Ctrl+C` to stop both servers gracefully 
