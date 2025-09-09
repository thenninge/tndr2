import os
import openai

# Sett opp Mistral API som OpenAI-kompatibel klient
openai.api_key = os.environ.get("MISTRAL_API_KEY")
openai.api_base = "https://api.mistral.ai/v1"

# Velg modell: "mistral-tiny" eller "mistral-medium"
model = os.environ.get("MISTRAL_MODEL", "mistral-tiny")

response = openai.chat.completions.create(
    model=model,
    messages=[
        {"role": "system", "content": "Du er en hjelpsom jaktassistent. Svar alltid på norsk."},
        {"role": "user", "content": "Hva er det beste postvalget ved NØ-vind?"}
    ],
    temperature=0.2,
    max_tokens=300,
)

print("--- Svar fra Mistral ---\n")
print(response.choices[0].message.content)
