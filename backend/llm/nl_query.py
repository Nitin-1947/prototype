import json
from .gemini_client import call_gemini_text

NL_QUERY_PROMPT = """
You are a network security compliance assistant. You have access to compliance analysis results
for the following network devices:

{results_json}

The user asks: "{question}"

Answer the question clearly and specifically, referencing exact device names, rule results,
and config details where relevant. If the question asks about specific devices, call them out.
If you cite a rule, mention the rule name. Keep your answer concise but complete.

At the end of your answer, on a new line, add:
DEVICES: <comma-separated list of device names that are relevant to this answer>
RULES: <comma-separated list of rule IDs that are relevant to this answer>
"""


async def answer_nl_query(question: str, all_results: list[dict]) -> dict:
    """
    Translate a natural-language compliance question into an answer
    grounded in the actual device results.
    """
    results_json = json.dumps(
        [
            {
                "device_name": r["device_name"],
                "vendor": r["vendor"],
                "compliance_score": r["compliance_score"],
                "rule_results": [
                    {
                        "rule_id": rr["rule_id"],
                        "rule_name": rr["rule_name"],
                        "status": rr["status"],
                        "explanation": rr["explanation"],
                    }
                    for rr in r["rule_results"]
                ],
            }
            for r in all_results
        ],
        indent=2,
    )

    prompt = NL_QUERY_PROMPT.format(results_json=results_json, question=question)
    raw = await call_gemini_text(prompt)

    # Parse the structured footer
    answer_lines = raw.split("\n")
    devices_line = next((l for l in answer_lines if l.startswith("DEVICES:")), "DEVICES:")
    rules_line = next((l for l in answer_lines if l.startswith("RULES:")), "RULES:")

    answer_text = "\n".join(
        l for l in answer_lines if not l.startswith("DEVICES:") and not l.startswith("RULES:")
    ).strip()

    relevant_devices = [d.strip() for d in devices_line.replace("DEVICES:", "").split(",") if d.strip()]
    cited_rules = [r.strip() for r in rules_line.replace("RULES:", "").split(",") if r.strip()]

    return {
        "answer": answer_text,
        "relevant_devices": relevant_devices,
        "cited_rules": cited_rules,
    }
