# mack-pipeline-chat (Cloudflare Worker)
Proxy for the "Ask the pipeline" panel (ask-pipeline.js). Secrets OPENAI_API_KEY and TEAM_PASSCODE are set on the Worker only, never in this repo.
Build: replace `MODEL_SRC` in worker.src.js with the contents of ../mack-pipeline-model.js, upload as module worker.js.
Endpoint: POST https://mack-pipeline-chat.pgraham974.workers.dev/chat {messages:[{role,content}]} with header X-Team-Passcode. CORS: https://pgraham974.github.io only.
