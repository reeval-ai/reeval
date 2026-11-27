from reeval_python import define_environment, evaluate, group, plugin

listed = define_environment(
    "listed",
    {
        "plugins": [
            plugin.marketplace("lint@github:acme/agent-plugins", ref="v3", only=["skills"]),
            plugin.marketplace("format@npm:@acme/plugins@2.0.0"),
        ]
    },
)


def marketplace_plugins():
    @evaluate("entries read at the trial")
    def entries(c): ...


group("marketplace plugins", {"environments": listed}, marketplace_plugins)
