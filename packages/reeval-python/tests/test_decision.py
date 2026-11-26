from reeval_python import Decision, DecisionUsage


def test_decision_from_wire_is_snake_case() -> None:
    d = Decision._from_wire(  # pyright: ignore[reportPrivateUsage]
        {
            "answers": {"done": {"type": "boolean", "probability": 0.9}},
            "usage": {"inputTokens": 10, "outputTokens": 2, "totalTokens": 12},
            "warnings": [],
            "response": {"modelId": "fake-decision", "timestamp": "2026-11-26T00:00:00.000Z"},
        }
    )
    assert d.answers["done"]["probability"] == 0.9
    assert d.usage == DecisionUsage(input_tokens=10, output_tokens=2, total_tokens=12)
    assert d.provider_metadata is None
    assert d.model_id == "fake-decision"
    assert d.timestamp == "2026-11-26T00:00:00.000Z"
